# Test Case 05: E-Commerce Order Lifecycle State Transitions

## Overview
Demonstrates state diffing when an order transitions from `payment_confirmed` to `shipped` after applying a promotional code and fulfillment details.

## Key Differences:
- 🔄 **Order Status**: Moved from `"payment_confirmed"` to `"shipped"`.
- 🏷️ **Promo Code & Recalculation**: Applied `"SUMMER15"` promo code (`discount: 15.00`), recalculated tax to `10.80`, waived shipping fee (`0.00`), reducing total from `167.97` to `145.78`.
- 📦 **Item Fulfillment Status**: Items status updated from `"allocated"` to `"packed"`.
- 🚚 **Fulfillment Metadata**: Populated `carrier` (`"FedEx Express"`), `tracking_number` (`"FX-994827103-US"`), and `shipped_at` timestamp.
