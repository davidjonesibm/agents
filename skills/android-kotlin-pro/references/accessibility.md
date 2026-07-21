# Accessibility

Target: Compose BOM 2024+, WCAG 2.1 AA.

## Content Descriptions

- **Always provide `contentDescription`** for interactive icons and meaningful images:

  ```kotlin
  // Before — inaccessible
  Icon(imageVector = Icons.Filled.Share, contentDescription = null)

  // After — accessible
  IconButton(onClick = { shareItem() }) {
      Icon(
          imageVector = Icons.Filled.Share,
          contentDescription = stringResource(R.string.share_action),
      )
  }
  ```

- **Set `contentDescription = null`** for purely decorative images so TalkBack skips them:

  ```kotlin
  Image(
      painter = painterResource(R.drawable.decorative_divider),
      contentDescription = null, // decorative, no semantic meaning
  )
  ```

- **Use `stringResource()`** for content descriptions — never hardcode strings, to support localization.

## Semantics Modifier

- Use the `semantics` modifier to provide rich accessibility information beyond what components expose by default:

  ```kotlin
  // Custom content description
  MyButton(
      modifier = Modifier.semantics { contentDescription = "Add to favorites" }
  )
  ```

- **Error semantics** — inform TalkBack about error states:

  ```kotlin
  TextField(
      value = email,
      onValueChange = { /* ... */ },
      modifier = Modifier.semantics {
          if (isError) error("Please enter a valid email address")
      },
  )
  ```

- **Pane title** — mark bottom sheets, dialogs, and panels so TalkBack announces them:

  ```kotlin
  BottomSheet(
      modifier = Modifier.semantics { paneTitle = "Filter options" }
  )
  ```

## Click Labels

- Provide descriptive click labels for TalkBack announcements:

  ```kotlin
  // Before — TalkBack says "double tap to activate"
  Row(modifier = Modifier.clickable { openArticle() }) { /* ... */ }

  // After — TalkBack says "double tap to open article"
  Row(modifier = Modifier.clickable(onClickLabel = "Open article") { openArticle() }) { /* ... */ }
  ```

- Override click label via semantics when `clickable` isn't directly accessible:

  ```kotlin
  NestedItem(
      modifier = Modifier.semantics {
          onClick(label = "Open this article", action = { true })
      }
  )
  ```

## Merging & Clearing Semantics

- **`Modifier.clickable` automatically merges descendant semantics** into a single accessible element. This is usually correct for list items.

- **Use `clearAndSetSemantics`** when you need full control over what TalkBack reads:

  ```kotlin
  Row(
      modifier = Modifier
          .toggleable(value = checked, onValueChange = { checked = it })
          .clearAndSetSemantics {
              stateDescription = if (checked) "Enabled" else "Disabled"
              toggleableState = ToggleableState(checked)
              role = Role.Switch
          },
  ) {
      Icon(Icons.Default.Notifications, contentDescription = null)
      Text("Push Notifications")
  }
  ```

## Custom Accessibility Actions

- Replace complex gestures (swipe-to-dismiss, long-press) with accessible alternatives:

  ```kotlin
  SwipeToDismissBox(
      modifier = Modifier.semantics {
          customActions = listOf(
              CustomAccessibilityAction(
                  label = "Remove article",
                  action = { removeArticle(); true },
              )
          )
      },
      state = rememberSwipeToDismissBoxState(),
      backgroundContent = {},
  ) {
      ArticleItem()
  }
  ```

## Touch Targets

- **Minimum touch target: 48dp × 48dp** (Material Design guideline). Compose enforces this in M3 components automatically.

- For custom composables, ensure adequate size:

  ```kotlin
  // Before — too small
  Box(modifier = Modifier.size(24.dp).clickable { /* ... */ })

  // After — meets minimum
  Box(modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).clickable { /* ... */ })
  ```

## Headings

- Mark section headings for TalkBack navigation:

  ```kotlin
  Text(
      text = "Settings",
      modifier = Modifier.semantics { heading() },
      style = MaterialTheme.typography.headlineMedium,
  )
  ```

## Live Regions

- Announce dynamic content updates (e.g., snackbars, counters) to TalkBack:

  ```kotlin
  Text(
      text = "Items in cart: $count",
      modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
  )
  ```

## Testing Accessibility

- Use `printToLog()` to inspect the semantics tree:

  ```kotlin
  composeTestRule.onRoot(useUnmergedTree = true).printToLog("A11Y")
  ```

- Assert content descriptions and semantic properties:

  ```kotlin
  composeTestRule
      .onNodeWithContentDescription("Share")
      .assertIsDisplayed()
  ```

## Checklist

1. All interactive elements have content descriptions or visible labels.
2. Decorative images have `contentDescription = null`.
3. Touch targets ≥ 48dp × 48dp.
4. Color is not the only way to convey information (provide text/icons too).
5. Text meets 4.5:1 contrast ratio (3:1 for large text).
6. Complex gestures have accessible alternatives (custom actions).
7. Dynamic content uses live regions.
8. Headings are marked semantically for navigation.
