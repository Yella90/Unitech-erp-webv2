# Guide d'utilisation des animations

## 1. Animations en cascade (Listes et Grilles)

Utilisez `getAnimationCascadeClass(index)` pour appliquer des animations décalées à chaque élément.

### Exemple avec Dashboard

```jsx
import { getAnimationCascadeClass } from '../utils/animations';

// Dans le rendu
{cards.map((card, idx) => (
  <div key={card.id} className={getAnimationCascadeClass(idx)}>
    {card.content}
  </div>
))}
```

Classes disponibles: `animate-cascade-1` à `animate-cascade-6` avec délai de 50ms progressif.

---

## 2. Boutons avec Ripple Effect

Utilisez `RippleButton` au lieu de `<button>` pour les actions principales (téléchargement, suppression, etc).

### Exemple

```jsx
import { RippleButton } from '../components/RippleButton';

<RippleButton
  onClick={() => handleDownloadPdf()}
  variant="primary"
  className="px-4 py-2"
>
  📥 Télécharger PDF
</RippleButton>
```

Variantes: `primary`, `secondary`, `danger`

---

## 3. Modal de Confirmation avec Animation

Utilisez `ConfirmationModal` pour les suppressions et actions irréversibles.

### Exemple

```jsx
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useState } from 'react';

function MyComponent() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/salaires/${id}`);
      toast.success('Salaire supprimé');
      setShowDeleteModal(false);
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <RippleButton
        variant="danger"
        onClick={() => setShowDeleteModal(true)}
      >
        Supprimer
      </RippleButton>

      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Confirmer la suppression"
        message="Cette action est irréversible. Êtes-vous sûr ?"
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
```

---

## 4. Highlight pour Nouvelles Lignes

Utilisez `HighlightRow`, `HighlightCell` ou `HighlightDiv` pour mettre en avant les éléments ajoutés.

### Exemple

```jsx
import { HighlightRow } from '../components/HighlightAnimated';

// Dans un tableau
<tbody>
  {rows.map((row, idx) => (
    <HighlightRow
      key={row.id}
      isNew={row.id > latestId}  // Highlight si nouvellement ajouté
      duration={3000}  // 3 secondes de highlight
    >
      <td>{row.name}</td>
      <td>{row.value}</td>
    </HighlightRow>
  ))}
</tbody>
```

---

## 5. Classes CSS d'Animation Directe

Pour des animations simples sans composants React:

```jsx
// Fade-in en cascade
<div className="animate-fadeInUp">Contenu</div>
<div className="animate-fadeInScale">Autre contenu</div>

// Utilité
<div className="animate-spin">⏳ Chargement...</div>
<div className="animate-pulse">Clignotement</div>
```

Classes disponibles:
- `animate-fadeInUp` - Apparition vers le haut
- `animate-fadeInDown` - Apparition vers le bas  
- `animate-fadeInScale` - Apparition avec zoom
- `animate-slideDown` - Glissade vers le bas
- `animate-slideUp` - Glissade vers le haut
- `animate-slideOutRight` - Disparition vers la droite
- `animate-shake` - Secousse légère
- `animate-shakeWarn` - Secousse forte
- `animate-spin` - Rotation
- `animate-spinBounce` - Rotation avec rebond
- `animate-pulse` - Pulsation infinie

---

## 6. Transitions Lisses

Classes pour transitions douces:

```jsx
<div className="transition-all-smooth hover:bg-slate-100">
  Transition fluide tous les propriétés
</div>

<div className="transition-opacity-smooth">
  Transition fluide opacité uniquement
</div>

<div className="transition-colors-smooth">
  Transition fluide des couleurs
</div>
```

---

## 7. Utilitaires JavaScript

### applyAnimation

```jsx
import { applyAnimation } from '../utils/animations';

// Sur une action
const handleAction = () => {
  applyAnimation(elementRef.current, 'shake', 600);
};
```

### triggerShake

```jsx
import { triggerShake } from '../utils/animations';

// Pour alerter l'utilisateur
const handleError = () => {
  triggerShake(formRef.current);
};
```

### triggerSpin

```jsx
import { triggerSpin } from '../utils/animations';

// Sur un bouton de rafraîchissement
const handleRefresh = () => {
  triggerSpin(iconRef.current);
  // ... refresh logic
};
```

---

## 8. Préférences Utilisateur pour Réduction d'Animations

Les animations respectent automatiquement `prefers-reduced-motion`. Pour les désactiver globalement:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Pages Prioritaires Implémentées

✅ **Dashboard** - Cartes en cascade  
✅ **ElevesListe** - Lignes en cascade + Boutons PDF Ripple  
⏳ **Profils** (en cours) - Onglets avec animations  
⏳ **Formulaires** - Shake sur erreur validation  
⏳ **Suppressions** - Modales avec fondu  

---

## Performance Notes

- Animations utilisant `transform` et `opacity` (pas de reflow/repaint)
- Durées: 150-300ms pour interactions, 300-500ms pour apparitions
- GPU acceleration via `will-change` sur animations longues
- Lazy loading des animations sur éléments visibles
