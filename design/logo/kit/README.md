# TWIG logo

A twig that curls at the foot like a lowercase **t**, with a leaf for its arm: the first letter of TWIG,
drawn as something small that grows. Concept W3 · Curled twig, made with the `logo-design` skill
(`.claude/skills/logo-design`). Open `kit.html` to see every file on light, dark and green backgrounds.

## Files

| File | Use |
|---|---|
| `twig-symbol.svg` | The mark in Twig green, on white or light backgrounds |
| `twig-symbol-white.svg` | On Twig green, photos or dark backgrounds |
| `twig-symbol-black.svg` | One-colour printing (stamps, photocopies, forms) |
| `twig-lockup.svg` | Mark + "wig", read as "twig"; headers, splash screens, documents |
| `twig-lockup-white.svg` / `-black.svg` | Reversed and one-colour lockups |
| `twig-app-icon.svg` | App icon tile; source of `apps/desktop/src-tauri/icons` and `public/twig.svg` |

Regenerate the app icons after changing the tile:

```bash
cd apps/desktop && npx tauri icon ../../design/logo/kit/twig-app-icon.svg
```

The command also writes `android/`, `ios/` and `64x64.png`, which the app doesn't use; delete them.

## Colours

| Name | HEX | RGB | Use |
|---|---|---|---|
| Twig green | `#047857` | 4 120 87 | The mark, buttons; same as the app's primary colour |
| Ink | `#1c1917` | 28 25 23 | The "wig" letters, text |
| Paper | `#ffffff` | 255 255 255 | Backgrounds, the mark reversed |

## Rules

- **Clear space:** keep at least the leaf's width empty around the mark.
- **Minimum size:** symbol 16 px; lockup 24 px tall.
- **Backgrounds:** green mark on white or light grey; white mark on green or dark. Never green on dark.
- **Don't** stretch, rotate, recolour the leaf alone, add shadows or outlines, or retype "wig" in a font.

## Open items

- "wig" in the lockup is drawn with round strokes; convert strokes to outlines before sending it to a printer.
- The skill's audit and export scripts need Python 3, which isn't installed; the files were checked by eye at
  16–150 px instead.
- No trademark search has been done.
