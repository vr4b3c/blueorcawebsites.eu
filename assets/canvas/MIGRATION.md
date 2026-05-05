# Migrace na Canvas System 2.0

## 🔄 Přehled

Starý monolitický `canvas-background.js` byl **kompletně nahrazen** novým modulárním systémem. Toto je jednorázová migrace - starý kód již není podporován.

## ⚠️ Důležité

- **Starý soubor je archivován** v `archive/canvas-background.js.old`
- **Žádná zpětná kompatibilita** - musíte aktualizovat váš kód
- **Nové API** - modernější a čistší
- **ES6 moduly** - vyžaduje HTTP server

## 📋 Krok za krokem

### 1. Aktualizace HTML

#### STARÉ (již nefunguje):
```html
<script src="canvas-background.js"></script>
<script>
    const manager = new CanvasBackgroundManager();
    manager.start();
</script>
```

#### NOVÉ (povinné):

**Varianta A - Automatická inicializace (nejjednodušší):**
```html
<script type="module" src="canvas/init.js"></script>
```

**Varianta B - Vlastní konfigurace:**
```html
<script type="module">
    import { createCanvasBackground } from './canvas/index.js';
    
    const manager = createCanvasBackground({
        zIndex: 0,
        showStats: true,
        targetFPS: 50
    });
    
    manager.start();
    window.blueOrcaCanvas = manager;
</script>
```

**Varianta C - Manuální setup:**
```html
<script type="module">
    import { CanvasManager } from './canvas/core/CanvasManager.js';
    import { WaterGradientLayer } from './canvas/layers/WaterGradientLayer.js';
    
    const manager = new CanvasManager({ zIndex: 0 });
    manager.addLayer('gradient', new WaterGradientLayer());
    manager.start();
    window.blueOrcaCanvas = manager;
</script>
```

### 2. API změny

| Starý způsob | Nový způsob |
|-------------|-------------|
| `new CanvasBackgroundManager()` | `new CanvasManager()` nebo `createCanvasBackground()` |
| `window.CanvasBackground.currentManager` | `window.blueOrcaCanvas` |
| `manager.performanceMetrics.fps` | `manager.performanceMonitor.getFPS()` |
| `manager.foodParticles` | `manager.getFoodParticles()` |

## ⚙️ HTTP Server (povinné)

ES6 moduly vyžadují HTTP server:

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve
```

## 🐛 Řešení problémů

### "Cannot use import statement"
Přidejte `type="module"` do script tagu.

### "Failed to resolve module"
Používejte HTTP server, ne `file://`

### "window.CanvasBackground is undefined"
To je správně! Použijte `window.blueOrcaCanvas`

## ✅ Checklist

- [ ] Archivován starý soubor
- [ ] Zkopírována složka `canvas/`
- [ ] Aktualizovány script tagy
- [ ] Změněn přístup k API
- [ ] Otestováno na HTTP serveru

---

📚 Více v [README.md](README.md) | 🚀 Start: [QUICK_START.md](QUICK_START.md)
