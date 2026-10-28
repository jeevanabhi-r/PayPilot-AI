
export const catalog = [
  {
    id: 'headphones',
    name: 'Studio Wireless Headphones',
    category: 'Electronics',
    price: 79.99,
    emoji: '🎧',
    color: '#9b8cff',
    description: 'Immersive sound · 32-hour battery'
  },
  {
    id: 'keyboard',
    name: 'Mechanical Keyboard Pro',
    category: 'Electronics',
    price: 119.00,
    emoji: '⌨️',
    color: '#50b9ef',
    description: 'Low-profile keys · RGB backlight'
  },
  {
    id: 'desk',
    name: 'Minimal Desk Lamp',
    category: 'Workspace',
    price: 44.50,
    emoji: '💡',
    color: '#f0ae65',
    description: 'Warm ambient light · USB-C'
  },
  {
    id: 'backpack',
    name: 'Everyday Tech Backpack',
    category: 'Lifestyle',
    price: 64.00,
    emoji: '🎒',
    color: '#78cfaa',
    description: 'Weatherproof · Laptop sleeve'
  },
  {
    id: 'mouse',
    name: 'Precision Wireless Mouse',
    category: 'Electronics',
    price: 39.99,
    emoji: '🖱️',
    color: '#ec8ca5',
    description: 'Silent clicks · Ergonomic'
  },
  {
    id: 'stand',
    name: 'Adjustable Laptop Stand',
    category: 'Workspace',
    price: 34.00,
    emoji: '💻',
    color: '#b7b5f4',
    description: 'Aluminum · Height adjustable'
  }
];

export function parseRequest(message) {
  const m = String(message || '').toLowerCase();

  // Recognize common budget phrases such as:
  // "under $50", "below 100", "budget of $75"
  const budgetMatch = m.match(
    /(?:under|below|budget(?:\s+of)?|less than|within|up to)\s*\$?\s*(\d+(?:\.\d{1,2})?)/
  );

  const budget = budgetMatch ? Number(budgetMatch[1]) : null;

  // Identify the requested product type.
  const keywords = [
    { id: 'headphones', words: ['headphones', 'headphone', 'earphones', 'earbuds'] },
    { id: 'keyboard', words: ['keyboard', 'keyboards', 'typing'] },
    { id: 'desk', words: ['desk lamp', 'lamp', 'lighting'] },
    { id: 'backpack', words: ['backpack', 'bag', 'laptop bag'] },
    { id: 'mouse', words: ['mouse', 'mice'] },
    { id: 'stand', words: ['laptop stand', 'stand'] }
  ];

  const requested = keywords.find(item =>
    item.words.some(word => m.includes(word))
  );

  // If a product type was requested, prefer that product.
  let product = requested
    ? catalog.find(p => p.id === requested.id)
    : null;

  // If a budget was specified, never recommend an over-budget product.
  if (budget !== null && (!product || product.price > budget)) {
    const affordable = catalog.filter(p => p.price <= budget);

    if (requested) {
      const sameCategory = affordable.filter(
        p => p.category === product?.category
      );

      product = sameCategory[0] || affordable[0] || null;
    } else {
      product = affordable[0] || null;
    }
  }

  // No suitable product exists within the requested budget.
  if (!product) {
    return {
      productId: null,
      budget,
      reason: budget !== null
        ? `No catalog products are available within your $${budget.toFixed(2)} budget.`
        : 'No suitable product was found in the catalog.',
      alternatives: [],
      withinBudget: false
    };
  }

  const alternatives = catalog
    .filter(p =>
      p.id !== product.id &&
      (budget === null || p.price <= budget)
    )
    .slice(0, 3)
    .map(p => p.id);

  return {
    productId: product.id,
    budget,
    reason: `${product.name} is a relevant catalog option${
      budget !== null ? ` within your $${budget.toFixed(2)} budget` : ''
    }. Review the product and price before checkout.`,
    alternatives,
    withinBudget: budget === null ? null : product.price <= budget
  };
}

export function validatePlan(plan) {
  if (!plan || !catalog.some(p => p.id === plan.productId)) {
    return null;
  }

  const product = catalog.find(p => p.id === plan.productId);

  // Reject a plan that violates the user's budget.
  if (
    typeof plan.budget === 'number' &&
    product.price > plan.budget
  ) {
    return null;
  }

  return plan;
}
