# 🚀 Rychlý start - Canvas System 2.0

## ⚡ 30 sekund - Minimální integrace

```html
<!DOCTYPE html>
<html>
<head>
    <title>Blue Orca</title>
</head>
<body>
    <!-- Vaše stránka -->
    <h1>Blue Orca</h1>
    
    <!-- PŘIDEJTE POUZE TUTO ŘÁDKU -->
    <script type="module" src="canvas/init.js"></script>
</body>
</html>
```

**Hotovo!** Canvas na pozadí funguje.

## ⏱️ 2 minuty - S vlastní konfigurací

```html
<!DOCTYPE html>
<html>
<head>
    <title>Blue Orca</title>
</head>
<body>
    <h1>Blue Orca</h1>
    
    <script type="module">
        import { createCanvasBackground } from './canvas/index.js';
        
        const manager = createCanvasBackground({
            zIndex: 0,          // Za obsahem
            showStats: true,    // Zobrazit FPS
            targetFPS: 50       // Cílové FPS
        });
        
        manager.start();
        
        // Uložit pro později
        window.myCanvas = manager;
    </script>
</body>
</html>
```

## 🎮 5 minut - Plná kontrola

```html
<!DOCTYPE html>
<html>
<head>
    <title>Blue Orca</title>
    <style>
        body { margin: 0; font-family: Arial; }
        .content { position: relative; z-index: 10; padding: 50px; }
    </style>
</head>
<body>
    <div class="content">
        <h1>Blue Orca</h1>
        <button onclick="toggleStats()">Toggle Stats</button>
        <button onclick="toggleBubbles()">Toggle Bubbles</button>
    </div>
    
    <script type="module">
        import { CanvasManager } from './canvas/core/CanvasManager.js';
        import { WaterGradientLayer } from './canvas/layers/WaterGradientLayer.js';
        import { BubblesLayer } from './canvas/layers/BubblesLayer.js';
        import { LightRaysLayer } from './canvas/layers/LightRaysLayer.js';
        
        // Vytvořit manager
        const manager = new CanvasManager({
            zIndex: 0,
            showStats: true,
            debug: false
        });
        
        // Přidat vrstvy s vlastní konfigurací
        manager.addLayer('gradient', new WaterGradientLayer({
            animationDuration: 15000  // Pomalejší animace
        }));
        
        manager.addLayer('bubbles', new BubblesLayer({
            count: 50,          // Více bublin
            riseSpeed: 0.8      // Rychlejší stoupání
        }));
        
        manager.addLayer('rays', new LightRaysLayer({
            rayCount: 7,        // Více paprsků
            rayOpacity: 0.1     // Viditelnější
        }));
        
        // Spustit
        manager.start();
        
        // Globální funkce pro tlačítka
        window.myCanvas = manager;
        window.toggleStats = () => manager.togglePerformanceStats();
        window.toggleBubbles = () => {
            const layer = manager.getLayer('bubbles');
            layer.enabled = !layer.enabled;
        };
    </script>
</body>
</html>
```

## 🧪 Test - Otevřít demo

```bash
# Přejděte do projektu
cd /path/to/blue-orca

# Spusťte HTTP server
python3 -m http.server 8000

# Nebo Node.js
npx serve

# Otevřete prohlížeč
open http://localhost:8000/canvas/demo.html
```

## 🔧 Spuštění testů

```html
<!-- Otevřete demo.html a v konzoli: -->
<script>
    import('./canvas/test.js')
        .then(() => console.log('✅ Testy dokončeny'));
</script>
```

## 📝 Nejčastější úlohy

### Změna FPS cíle
```javascript
const manager = createCanvasBackground({
    targetFPS: 30  // Pro mobilní zařízení
});
```

### Vypnutí statistik
```javascript
const manager = createCanvasBackground({
    showStats: false
});
```

### Přidání vlastní vrstvy
```javascript
class MyLayer {
    constructor() { this.enabled = true; }
    init(w, h) { this.width = w; this.height = h; }
    render(ctx, time, dt, w, h) {
        ctx.fillStyle = 'rgba(255,0,0,0.1)';
        ctx.fillRect(0, 0, w, h);
    }
}

manager.addLayer('myLayer', new MyLayer());
```

### Odstranění vrstvy
```javascript
manager.removeLayer('bubbles');
```

### Toggle vrstva on/off
```javascript
const layer = manager.getLayer('bubbles');
layer.enabled = !layer.enabled;
```

### Získání FPS
```javascript
const fps = manager.performanceMonitor.getFPS();
console.log('FPS:', fps);
```

## 🆘 Problémy?

### "Cannot use import outside module"
**Řešení:** Přidejte `type="module"` do script tagu
```html
<script type="module" src="..."></script>
```

### "Failed to load module"
**Řešení:** Používejte HTTP server, ne `file://`
```bash
python3 -m http.server 8000
```

### Canvas se nezobrazuje
**Řešení:** Zkontrolujte z-index a konzoli
```javascript
console.log(manager.canvas);  // Mělo by vrátit element
```

### Nízké FPS
**Řešení:** Snižte počet částic
```javascript
const manager = createCanvasBackground({
    targetFPS: 30,
    foodConfig: {
        count: 3  // Méně částic
    }
});
```

## 📚 Další kroky

1. **Přečtěte si README.md** - Kompletní dokumentace
2. **Vyzkoušejte demo.html** - Interaktivní ukázka
3. **Podívejte se na MIGRATION.md** - Migrace ze starého kódu
4. **Experimentujte s vrstvami** - Přidávejte vlastní efekty

## 🎉 Hotovo!

Nyní máte funkční canvas background systém.

**Klikněte kamkoliv na stránku** - vytvoří se částice jídla! 🍎

---

**Potřebujete pomoc?** Podívejte se do:
- `canvas/README.md` - Dokumentace
- `canvas/demo.html` - Příklad
- `canvas/test.js` - Testy
