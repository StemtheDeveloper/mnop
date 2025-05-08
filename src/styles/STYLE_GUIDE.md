# MNOP Application Style Guide

This document outlines the standardized styling approach for the MNOP application to ensure a consistent user experience across all components and user roles.

## Using the Responsive CSS System

Our application uses a utility-based CSS approach in `responsive.css`, providing consistent styling for all common UI elements.

### Key Components

#### Buttons

Use the `.btn` class combined with color variants:

```html
<!-- Primary (red) button -->
<button class="btn btn-primary">Submit</button>

<!-- Secondary (blue) button -->
<button class="btn btn-secondary">View Details</button>

<!-- Success (green) button -->
<button class="btn btn-success">Approve</button>

<!-- Outline button -->
<button class="btn btn-outline-primary">Cancel</button>

<!-- Size variants -->
<button class="btn btn-primary btn-sm">Small Button</button>
<button class="btn btn-primary btn-lg">Large Button</button>
```

#### Form Controls

Form elements should use these consistent styles:

```html
<div class="form-group">
  <label for="nameInput">Name</label>
  <input
    type="text"
    class="form-control"
    id="nameInput"
    placeholder="Enter name"
  />
</div>

<!-- Form row for multiple fields in a line -->
<div class="form-row">
  <div class="form-group">
    <label>First Name</label>
    <input type="text" class="form-control" />
  </div>
  <div class="form-group">
    <label>Last Name</label>
    <input type="text" class="form-control" />
  </div>
</div>

<!-- Toggle switch -->
<label class="form-switch">
  <input type="checkbox" />
  <span class="slider"></span>
</label>
```

#### Messages & Alerts

For notifications and messages:

```html
<!-- Success message -->
<div class="message success">Operation completed successfully!</div>

<!-- Error message -->
<div class="message error">An error occurred. Please try again.</div>

<!-- Alerts with different contextual styles -->
<div class="alert alert-primary">Important information</div>
<div class="alert alert-warning">Warning: This action cannot be undone.</div>
```

#### Cards

For content containers:

```html
<div class="card">
  <div class="card-header">Card Title</div>
  <div class="card-body">Content goes here...</div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

#### Layout Utilities

Use flexbox and grid utilities for layouts:

```html
<!-- Simple flex container -->
<div class="flex justify-between items-center">
  <div>Left content</div>
  <div>Right content</div>
</div>

<!-- Grid layout -->
<div class="grid grid-3 gap-md">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>

<!-- Responsive grid -->
<div class="responsive-grid">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
</div>
```

#### Spacing and Typography

Consistent spacing and typography classes:

```html
<!-- Margin and padding -->
<div class="mt-md mb-lg px-sm py-md">Spaced content</div>

<!-- Typography -->
<h1 class="text-2xl font-weight-bold mb-md">Large Heading</h1>
<p class="text-md text-muted">Normal paragraph text.</p>
```

## Color Palette

Our application uses a consistent color palette:

- Primary (Red): `#ef3c23` - Used for primary actions and main branding
- Secondary (Blue): `#3949ab` - Used for secondary actions and accents
- Success (Green): `#4caf50` - Used for success indicators and approve actions
- Warning (Orange): `#ff9800` - Used for warnings and important notices
- Danger (Red): `#f44336` - Used for error messages and delete actions

## Rules for Consistent Styling

1. **Always use the utility classes** from responsive.css instead of inline styles
2. **Use the standardized components** for common elements like buttons, forms, and alerts
3. **Follow the color palette** to maintain visual consistency
4. **Don't mix styling approaches** - use the utility classes as the primary approach
5. **Make elements mobile-responsive** by default
6. **Ensure accessible color contrast** for all text and interactive elements
7. **Use the pill-shaped buttons** (rounded edges) for all buttons as per our brand style

## Responsive Design

- Use the `responsive-grid` class for grid layouts that adapt to screen size
- Use flexbox utilities with the `stack-on-mobile` class for layouts that should stack on smaller screens
- Hide elements on specific screen sizes with classes like `hidden-xs`, `hidden-sm`, etc.
- Use the mobile-specific helper classes like `mobile-center` and `mobile-order-first` to adjust layouts for smaller screens

By following this style guide, we'll maintain a consistent user experience across all parts of the application, regardless of which user role is accessing it.
