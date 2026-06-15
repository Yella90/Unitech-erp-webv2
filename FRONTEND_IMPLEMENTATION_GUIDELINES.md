# Frontend Implementation Guidelines

## 1. Creating New Pages

### Page Structure Template

```jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function NewPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/endpoint');
        setItems(response.data || []);
      } catch (err) {
        if (err?.response?.status === 401) {
          window.location.href = '/login';
          return;
        }
        setError('Erreur lors du chargement des donnees.');
        console.error('Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Handle error state
  if (showLoading) {
    return <PageLoadingState title="Chargement" message="Les donnees sont en cours de chargement." />;
  }

  if (error && items.length === 0) {
    return (
      <PageErrorState
        title="Erreur d'affichage"
        message={error}
        action={
          <button onClick={() => window.location.reload()} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Reessayer
          </button>
        }
      />
    );
  }

  return (
    <section className="space-y-5">
      {/* Notifications */}
      <PageBanner tone="success" title={success ? 'Succes' : ''} message={success} />
      <PageBanner tone="error" title={error && items.length > 0 ? 'Erreur' : ''} message={items.length > 0 ? error : ''} />

      {/* Page Content */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Item content */}
          </div>
        ))}
      </div>
    </section>
  );
}

export default NewPage;
```

## 2. Form Best Practices

### Form Component Pattern

```jsx
import { FormInput, FormSelect, FormTextarea } from '../components/FormInput';

function MyForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
    description: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Handle input change and clear associated error
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.category.trim()) newErrors.category = 'Category is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSuccess('');
    try {
      await api.post('/endpoint', formData);
      setSuccess('Item created successfully!');
      setFormData({ name: '', email: '', category: '', description: '' });
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Server error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Global error */}
      {errors.submit && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errors.submit}
        </div>
      )}

      {/* Form fields */}
      <FormInput
        label="Name"
        type="text"
        name="name"
        placeholder="Enter name"
        value={formData.name}
        onChange={handleChange}
        error={errors.name}
        required
      />

      <FormInput
        label="Email"
        type="email"
        name="email"
        placeholder="Enter email"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        required
      />

      <FormSelect
        label="Category"
        name="category"
        value={formData.category}
        onChange={handleChange}
        error={errors.category}
        required
      >
        <option value="">Select a category</option>
        <option value="cat1">Category 1</option>
        <option value="cat2">Category 2</option>
      </FormSelect>

      <FormTextarea
        label="Description"
        name="description"
        placeholder="Enter description..."
        value={formData.description}
        onChange={handleChange}
        rows="4"
      />

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:bg-indigo-400"
      >
        {loading ? 'Creating...' : 'Create Item'}
      </button>
    </form>
  );
}
```

## 3. Table Component Pattern

```jsx
function DataTable({ data = [], columns = [], loading = false }) {
  if (loading) {
    return <PageLoadingState title="Loading table..." />;
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr className="border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${
                  col.align === 'right' ? 'text-right' : ''
                }`}
              >
                {col.label}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              {columns.map((col) => (
                <td
                  key={`${row.id}-${col.key}`}
                  className={`px-4 py-3 text-slate-700 ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## 4. Responsive Grid Patterns

### Metric Cards Grid
```jsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {metrics.map((metric, idx) => (
    <MetricCard
      key={metric.id}
      {...metric}
      className={getAnimationCascadeClass(idx)}
    />
  ))}
</div>
```

### Form and Table Side-by-Side
```jsx
<div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
  {/* Form section - narrower */}
  <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    {/* Form fields */}
  </form>

  {/* Table section - wider */}
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-x-auto">
    {/* Table */}
  </div>
</div>
```

## 5. Styling Best Practices

### ✅ DO

```jsx
// Use consistent container
className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"

// Use semantic elements
<label className="text-sm font-medium text-slate-700">Label</label>

// Use Tailwind utilities
className="space-y-4 grid gap-4"

// Combine responsive classes
className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100"

// Use color semantic names
className="text-emerald-600 bg-emerald-50 border-emerald-200"
```

### ❌ DON'T

```jsx
// Don't use inline styles with Tailwind
style={{ color: '#4f46e5' }}  // Use text-indigo-600 instead

// Don't create custom color variations
className="bg-[#custom-color]"  // Stick to Tailwind palette

// Don't mix shadow utilities inconsistently
className="drop-shadow-lg shadow-2xl"  // Pick one approach

// Don't use hardcoded spacing
style={{ marginTop: '20px' }}  // Use space-y-5 instead

// Don't create custom animations without reuse
@keyframes customAnimation { ... }  // Use existing animations.css
```

## 6. Animation Usage

### Apply Cascade to List Items
```jsx
import { getAnimationCascadeClass } from '../utils/animations';

function ItemList({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className={getAnimationCascadeClass(index)}>
          {/* Item content */}
        </div>
      ))}
    </div>
  );
}
```

### Apply Shake Animation to Form Error
```jsx
import { FormInput } from '../components/FormInput';

// FormInput component automatically applies shake on error
<FormInput
  label="Email"
  error={errors.email}  // Shake animation triggers when error appears
  {...props}
/>
```

### Manual Animation Trigger
```jsx
import { triggerShake, applyAnimation } from '../utils/animations';

const handleError = () => {
  triggerShake(inputRef.current);  // 600ms shake
  applyAnimation(element, 'fadeInUp', 400);  // Custom animation
};
```

## 7. Accessibility Best Practices

### Form with Proper Labels
```jsx
<div className="space-y-4">
  <div>
    <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
      Email Address
      <span className="text-red-600 ml-1">*</span>
    </label>
    <input
      id="email"
      type="email"
      className="w-full rounded-md border border-slate-300 px-3 py-2 
                 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      required
    />
    {errors.email && (
      <p className="mt-1 text-xs text-red-600 font-medium" role="alert">
        {errors.email}
      </p>
    )}
  </div>
</div>
```

### Accessible Icon Buttons
```jsx
// BAD - Missing accessible name
<button><TrashIcon /></button>

// GOOD - With aria-label
<button aria-label="Delete item"><TrashIcon /></button>

// GOOD - With visible text
<button>
  <TrashIcon className="inline" />
  <span className="ml-2">Delete</span>
</button>
```

### Table with Caption
```jsx
<table>
  <caption className="sr-only">Student List with enrollment dates</caption>
  <thead>
    <tr>
      <th>Student Name</th>
      <th>Class</th>
      <th>Enrollment Date</th>
    </tr>
  </thead>
  <tbody>
    {/* Table body */}
  </tbody>
</table>
```

### Error Summary Region
```jsx
{Object.keys(errors).length > 0 && (
  <div role="region" aria-live="polite" aria-label="Form errors" className="rounded-lg border border-rose-200 bg-rose-50 p-4">
    <h3 className="font-semibold text-rose-700 mb-2">Please fix the following errors:</h3>
    <ul className="list-disc list-inside text-sm text-rose-700 space-y-1">
      {Object.entries(errors).map(([field, error]) => (
        <li key={field}>{error}</li>
      ))}
    </ul>
  </div>
)}
```

## 8. Performance Optimization

### Memoization for Large Lists
```jsx
import { useMemo } from 'react';

function FilteredList({ items, searchQuery }) {
  // Memoize filtered results to prevent unnecessary recalculations
  const filteredItems = useMemo(
    () => items.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [items, searchQuery]
  );

  return (
    <ul>
      {filteredItems.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

### Debounced Search Input
```jsx
import { useState, useCallback } from 'react';

function SearchInput({ onSearch }) {
  const [value, setValue] = useState('');

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Debounce API call
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      onSearch(newValue);
    }, 300);
  }, [onSearch]);

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      className="w-full rounded-md border border-slate-300 px-3 py-2"
    />
  );
}
```

## 9. Common Patterns

### Loading State Management
```jsx
const { loading, data, error } = useQuery('/endpoint');
const showLoading = usePageLoadingVisibility(loading);

if (showLoading) {
  return <PageLoadingState />;
}

if (error && !data) {
  return <PageErrorState message={error} />;
}

return <PageContent data={data} />;
```

### Success/Error Toast Pattern
```jsx
const [success, setSuccess] = useState('');
const [error, setError] = useState('');

const handleAction = async () => {
  setSuccess('');
  setError('');
  try {
    await api.post('/endpoint');
    setSuccess('Action completed successfully!');
  } catch (err) {
    setError(err.response?.data?.error || 'An error occurred');
  }
};

return (
  <>
    <PageBanner tone="success" message={success} />
    <PageBanner tone="error" title="Error" message={error} />
    {/* Content */}
  </>
);
```

### Modal Confirmation Pattern
```jsx
const [confirmDialog, setConfirmDialog] = useState({
  open: false,
  title: '',
  message: '',
  onConfirm: null,
});

const openConfirm = (title, message, onConfirm) => {
  setConfirmDialog({ open: true, title, message, onConfirm });
};

return (
  <>
    <ConfirmDialog
      open={confirmDialog.open}
      title={confirmDialog.title}
      message={confirmDialog.message}
      onConfirm={() => {
        confirmDialog.onConfirm?.();
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
      }}
      onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
    />
  </>
);
```

---

## Code Review Checklist

When reviewing frontend code, ensure:

- [ ] Page follows standard structure (load effect, error handling, loading state)
- [ ] Form fields use FormInput/FormSelect/FormTextarea
- [ ] Error messages have `role="alert"`
- [ ] Icon-only buttons have `aria-label`
- [ ] Tables have `<caption>`
- [ ] Responsive classes for mobile/tablet/desktop
- [ ] No inline styles (use Tailwind)
- [ ] No hardcoded color values (use palette)
- [ ] Consistent container styling (rounded-xl border shadow-sm)
- [ ] API errors handle 401 redirect
- [ ] Loading state shows PageLoadingState
- [ ] Success/error messages use PageBanner
- [ ] Forms have validation with error display
- [ ] No console errors/warnings
- [ ] Performance optimizations for large lists
- [ ] Accessibility attributes present

---

*Implementation Guidelines v1.0*  
*Last Updated: June 2, 2026*
