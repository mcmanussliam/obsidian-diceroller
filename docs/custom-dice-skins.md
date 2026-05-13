# Custom Dice Skins

Custom skins let you change how dice look and sound.

## Folder Location

Create a `dice-skins` folder at the root of your vault:

```text
Your Vault/
  dice-skins/
    stone-dice/
      skin.json
      d20.glb
      albedo.png
      normal.png
      collision.wav
      result.wav
```

Each skin gets its own folder. Each skin folder needs a `skin.json` file.

## Basic Skin File

```json
{
  "id": "stone-dice",
  "name": "Stone Dice",
  "source": "vault",
  "maps": {
    "albedo": "albedo.png",
    "normal": "normal.png"
  },
  "sounds": {
    "collision": "collision.wav",
    "result": "result.wav"
  }
}
```

## Adding GLB Models

You can provide custom GLB files for specific dice:

```json
{
  "id": "stone-dice",
  "name": "Stone Dice",
  "source": "vault",
  "meshAssets": {
    "6": "d6.glb",
    "20": "d20.glb"
  }
}
```

If a die does not have a GLB file, the plugin uses generated dice geometry with
the skin material.

## Skin Fields

| Field                | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `id`                 | Unique ID for the skin. Keep this stable.                                                   |
| `name`               | Name shown in the plugin settings.                                                          |
| `meshAssets`         | Optional GLB files by die side, like `"20": "d20.glb"`.                                     |
| `maps`               | Optional texture files: `albedo`, `normal`, `roughness`, `metalness`, `ao`, and `emissive`. |
| `materialParams`     | Optional material values like `roughness`, `metalness`, `clearcoat`, and `envMapIntensity`. |
| `meshRotationOffset` | Optional `[x, y, z]` rotation in degrees for aligning imported models.                      |
| `numberStyle`        | Use `"baked"` if numbers are already included in your model or texture.                     |
| `sounds`             | Optional `collision` and `result` audio files.                                              |

## Selecting A Skin

After adding a skin folder:

1. Reload Obsidian.
2. Open **Settings -> Community Plugins -> Obsidian Dice Roller**.
3. Choose the skin from **Dice skin**.
