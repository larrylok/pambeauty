// Client-side analytics tracker
// Logs events to console and could be connected to analytics service

const analytics = {
  track(eventName, properties = {}) {
    const event = {
      event: eventName,
      timestamp: new Date().toISOString(),
      ...properties,
    };
    
    console.log('[Analytics]', event);
    
    // Store in localStorage for reporting
    const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
    events.push(event);
    // Keep only last 1000 events
    if (events.length > 1000) {
      events.shift();
    }
    localStorage.setItem('analytics_events', JSON.stringify(events));
  },

  pageView(pageName, properties = {}) {
    this.track('page_view', { page: pageName, ...properties });
  },

  productView(productId, productName) {
    this.track('product_view', { product_id: productId, product_name: productName });
  },

  addToCart(productId, productName, variant, quantity, price) {
    this.track('add_to_cart', {
      product_id: productId,
      product_name: productName,
      variant,
      quantity,
      price,
    });
  },

  removeFromCart(productId) {
    this.track('remove_from_cart', { product_id: productId });
  },

  initiateCheckout(cartTotal, itemCount) {
    this.track('initiate_checkout', { cart_total: cartTotal, item_count: itemCount });
  },

  purchase(orderId, total, items) {
    this.track('purchase', {
      order_id: orderId,
      total,
      item_count: items.length,
      items,
    });
  },

  addToWishlist(productId, productName) {
    this.track('add_to_wishlist', { product_id: productId, product_name: productName });
  },

  search(query, resultsCount) {
    this.track('search', { query, results_count: resultsCount });
  },
};

export default analytics;
