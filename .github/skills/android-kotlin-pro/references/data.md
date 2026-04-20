# Room & DataStore

Target: Room 2.6+, DataStore 1.2+.

## Room — Entity Definition

- Use `@Entity` data classes with `@PrimaryKey`. Prefer `autoGenerate = true` for local-only IDs.

  ```kotlin
  @Entity(tableName = "tasks")
  data class TaskEntity(
      @PrimaryKey(autoGenerate = true) val id: Long = 0,
      @ColumnInfo(name = "title") val title: String,
      @ColumnInfo(name = "is_completed") val isCompleted: Boolean = false,
      @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
  )
  ```

## Room — DAO

- Use `suspend` functions for one-shot write operations. Use `Flow` for observable reads.

  ```kotlin
  @Dao
  interface TaskDao {
      @Query("SELECT * FROM tasks ORDER BY created_at DESC")
      fun observeAll(): Flow<List<TaskEntity>>

      @Query("SELECT * FROM tasks WHERE id = :id")
      suspend fun getById(id: Long): TaskEntity?

      @Insert(onConflict = OnConflictStrategy.REPLACE)
      suspend fun upsert(task: TaskEntity)

      @Insert(onConflict = OnConflictStrategy.REPLACE)
      suspend fun upsertAll(tasks: List<TaskEntity>)

      @Delete
      suspend fun delete(task: TaskEntity)

      @Query("DELETE FROM tasks")
      suspend fun deleteAll()
  }
  ```

- **Never use `Flow` for single-item lookups that don't need observation.** Use `suspend` + `@Query`.

- **Never block the main thread.** Room enforces this — all DAO methods must be `suspend` or return `Flow`/`PagingSource`.

## Room — Database

```kotlin
@Database(entities = [TaskEntity::class], version = 1, exportSchema = true)
abstract class AppDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
}
```

- **Always set `exportSchema = true`** to enable migration testing with exported JSON schemas.

- Provide via Hilt:

  ```kotlin
  @Module
  @InstallIn(SingletonComponent::class)
  object DatabaseModule {
      @Provides
      @Singleton
      fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
          Room.databaseBuilder(context, AppDatabase::class.java, "app-database")
              .fallbackToDestructiveMigration() // Only for development!
              .build()

      @Provides
      fun provideTaskDao(db: AppDatabase): TaskDao = db.taskDao()
  }
  ```

## Room — Migrations

- **Always write migrations for production apps.** Use `fallbackToDestructiveMigration()` only during early development.

  ```kotlin
  val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(db: SupportSQLiteDatabase) {
          db.execSQL("ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0")
      }
  }

  Room.databaseBuilder(context, AppDatabase::class.java, "app-database")
      .addMigrations(MIGRATION_1_2)
      .build()
  ```

- Use the Room Gradle Plugin to export schemas for testing:

  ```kotlin
  plugins { id("androidx.room") }
  room { schemaDirectory("$projectDir/schemas") }
  ```

## Room — Type Converters

```kotlin
class Converters {
    @TypeConverter
    fun fromTimestamp(value: Long?): Instant? = value?.let { Instant.fromEpochMilliseconds(it) }

    @TypeConverter
    fun toTimestamp(instant: Instant?): Long? = instant?.toEpochMilliseconds()
}

@Database(entities = [TaskEntity::class], version = 1)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() { /* ... */ }
```

## Room — KSP Setup

```kotlin
plugins {
    id("com.google.devtools.ksp")
    id("androidx.room")
}

dependencies {
    implementation(libs.room.runtime)
    implementation(libs.room.ktx) // Coroutine/Flow support
    ksp(libs.room.compiler)       // KSP, not KAPT
}
```

## Preferences DataStore

- **Use DataStore instead of SharedPreferences** for all new code. Thread-safe, non-blocking, uses Kotlin coroutines and Flow.

- Declare as a top-level singleton:

  ```kotlin
  val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")
  ```

- Define keys and read/write:

  ```kotlin
  object PreferenceKeys {
      val DARK_MODE = booleanPreferencesKey("dark_mode")
      val FONT_SIZE = intPreferencesKey("font_size")
  }

  class SettingsRepository @Inject constructor(
      @ApplicationContext private val context: Context,
  ) {
      val darkMode: Flow<Boolean> = context.settingsDataStore.data
          .map { prefs -> prefs[PreferenceKeys.DARK_MODE] ?: false }

      suspend fun setDarkMode(enabled: Boolean) {
          context.settingsDataStore.edit { prefs ->
              prefs[PreferenceKeys.DARK_MODE] = enabled
          }
      }
  }
  ```

## Proto DataStore

- For structured/typed data beyond key-value pairs, use Proto DataStore with Protocol Buffers:

  ```kotlin
  object SettingsSerializer : Serializer<Settings> {
      override val defaultValue: Settings = Settings.getDefaultInstance()

      override suspend fun readFrom(input: InputStream): Settings {
          try {
              return Settings.parseFrom(input)
          } catch (e: InvalidProtocolBufferException) {
              throw CorruptionException("Cannot read proto.", e)
          }
      }

      override suspend fun writeTo(t: Settings, output: OutputStream) = t.writeTo(output)
  }

  val Context.settingsDataStore: DataStore<Settings> by dataStore(
      fileName = "settings.pb",
      serializer = SettingsSerializer,
  )
  ```

## Common Mistakes

- **Never call `DataStore.data.first()` on the main thread** — it performs disk I/O. Always collect in a coroutine.
- **Never create multiple DataStore instances for the same file** — use a singleton (top-level `by preferencesDataStore()`).
- **Never mix SharedPreferences and DataStore for the same data** — migrate fully.
- **Never use `allowMainThreadQueries()`** in Room for production code.
