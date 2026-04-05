# M-Pesa STK Push Integration Guide

## Overview
This guide provides step-by-step instructions for integrating **M-Pesa STK Push** (Lipa Na M-Pesa Online) into the Luxe Looks e-commerce platform.

## Current Status
⚠️ **Demo Mode Active**: The app currently uses a mock M-Pesa integration for testing. This guide will help you implement the production version.

---

## Prerequisites

### 1. Safaricom Developer Account
1. Visit [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Create an account
3. Complete KYC verification
4. Create a new app in the portal

### 2. Required Credentials
You'll need the following from Safaricom:
- **Consumer Key**: Identifies your app
- **Consumer Secret**: Secret key for authentication
- **Passkey**: Business short code passkey
- **Business Short Code**: Your M-Pesa till/paybill number
- **Callback URL**: Your server URL for payment notifications

---

## Integration Architecture

```
Frontend (React)
    |
    | 1. Initiate payment request
    v
Backend (FastAPI)
    |
    | 2. Get OAuth token from Safaricom
    | 3. Send STK Push request
    v
Safaricom M-Pesa API
    |
    | 4. Send STK Push to customer phone
    v
Customer Phone
    |
    | 5. Customer enters PIN
    | 6. Payment processed
    v
Safaricom M-Pesa API
    |
    | 7. Send callback to your server
    v
Backend (FastAPI)
    |
    | 8. Update order status
    | 9. Send confirmation to frontend
    v
Frontend (React)
```

---

## Step 1: Configure Environment Variables

Add to `/app/backend/.env`:

```bash
# M-Pesa Configuration
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_PASSKEY=your_passkey_here
MPESA_SHORTCODE=your_shortcode_here
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
MPESA_ENVIRONMENT=sandbox  # or 'production'
```

**Important**: Never commit these credentials to version control!

---

## Step 2: Install Required Packages

```bash
cd /app/backend
pip install httpx python-dotenv
pip freeze > requirements.txt
```

---

## Step 3: Create M-Pesa Service

Create `/app/backend/services/mpesa_service.py`:

```python
import httpx
import base64
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class MPesaService:
    def __init__(self):
        self.consumer_key = os.getenv('MPESA_CONSUMER_KEY')
        self.consumer_secret = os.getenv('MPESA_CONSUMER_SECRET')
        self.passkey = os.getenv('MPESA_PASSKEY')
        self.shortcode = os.getenv('MPESA_SHORTCODE')
        self.callback_url = os.getenv('MPESA_CALLBACK_URL')
        self.environment = os.getenv('MPESA_ENVIRONMENT', 'sandbox')
        
        # Set API URLs based on environment
        if self.environment == 'production':
            self.base_url = 'https://api.safaricom.co.ke'
        else:
            self.base_url = 'https://sandbox.safaricom.co.ke'
    
    async def get_access_token(self):
        """
        Get OAuth access token from Safaricom API
        """
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        
        # Create basic auth credentials
        credentials = f"{self.consumer_key}:{self.consumer_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            'Authorization': f'Basic {encoded_credentials}'
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                return data['access_token']
        except Exception as e:
            logger.error(f"Error getting access token: {e}")
            raise
    
    async def initiate_stk_push(self, phone_number: str, amount: int, account_reference: str, transaction_desc: str):
        """
        Initiate STK Push to customer phone
        
        Args:
            phone_number: Customer phone (format: 254XXXXXXXXX)
            amount: Amount to charge (integer, no decimals)
            account_reference: Order number or reference
            transaction_desc: Description of transaction
        
        Returns:
            dict: Response from M-Pesa API
        """
        # Get access token
        access_token = await self.get_access_token()
        
        # Generate timestamp
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        # Generate password
        password_str = f"{self.shortcode}{self.passkey}{timestamp}"
        password = base64.b64encode(password_str.encode()).decode()
        
        # Prepare request
        url = f"{self.base_url}/mpesa/stkpush/v1/processrequest"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'BusinessShortCode': self.shortcode,
            'Password': password,
            'Timestamp': timestamp,
            'TransactionType': 'CustomerPayBillOnline',
            'Amount': amount,
            'PartyA': phone_number,
            'PartyB': self.shortcode,
            'PhoneNumber': phone_number,
            'CallBackURL': self.callback_url,
            'AccountReference': account_reference,
            'TransactionDesc': transaction_desc
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error initiating STK push: {e}")
            raise
```

---

## Step 4: Add Backend Endpoints

Update `/app/backend/server.py` to add M-Pesa endpoints:

```python
from services.mpesa_service import MPesaService

mpesa_service = MPesaService()

# Initiate M-Pesa Payment
@api_router.post("/mpesa/initiate")
async def initiate_mpesa_payment(request: dict):
    """
    Initiate M-Pesa STK Push
    
    Body:
    - phone: Customer phone number (254XXXXXXXXX format)
    - amount: Amount to charge
    - order_number: Order reference
    """
    try:
        phone = request['phone']
        amount = int(request['amount'])
        order_number = request['order_number']
        
        # Ensure phone is in correct format
        if phone.startswith('+'):
            phone = phone[1:]
        if phone.startswith('0'):
            phone = '254' + phone[1:]
        
        response = await mpesa_service.initiate_stk_push(
            phone_number=phone,
            amount=amount,
            account_reference=order_number,
            transaction_desc=f'Payment for order {order_number}'
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error initiating payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# M-Pesa Callback
@api_router.post("/mpesa/callback")
async def mpesa_callback(callback_data: dict):
    """
    Receive payment confirmation from Safaricom
    """
    try:
        logger.info(f"M-Pesa callback received: {callback_data}")
        
        # Extract callback data
        body = callback_data.get('Body', {}).get('stkCallback', {})
        result_code = body.get('ResultCode')
        result_desc = body.get('ResultDesc')
        
        if result_code == 0:
            # Payment successful
            callback_metadata = body.get('CallbackMetadata', {}).get('Item', [])
            
            # Extract payment details
            payment_details = {}
            for item in callback_metadata:
                payment_details[item['Name']] = item.get('Value')
            
            # Get order number from metadata
            merchant_request_id = body.get('MerchantRequestID')
            
            # Update order status in database
            # TODO: Find order by merchant request ID and update
            # await db.orders.update_one(
            #     {'mpesaRequestId': merchant_request_id},
            #     {'$set': {
            #         'payment.status': 'confirmed',
            #         'payment.mpesaTransactionId': payment_details.get('MpesaReceiptNumber'),
            #         'payment.confirmedAt': datetime.now(timezone.utc).isoformat(),
            #         'status': 'processing'
            #     }}
            # )
            
            logger.info(f"Payment successful: {payment_details.get('MpesaReceiptNumber')}")
        else:
            # Payment failed
            logger.warning(f"Payment failed: {result_desc}")
            # TODO: Update order status to failed
        
        return {"ResultCode": 0, "ResultDesc": "Success"}
        
    except Exception as e:
        logger.error(f"Error processing callback: {e}")
        return {"ResultCode": 1, "ResultDesc": "Failed"}
```

---

## Step 5: Update Frontend Checkout

Update `/app/frontend/src/pages/Checkout.js` to call real M-Pesa API:

```javascript
const handlePayment = async () => {
  if (paymentMethod === "mpesa" && !mpesaPhone) {
    toast.error("Please enter your M-Pesa phone number");
    return;
  }

  setProcessingPayment(true);

  try {
    // Create order first
    const totals = calculateCartTotals();
    const orderNumber = `LX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

    // Initiate M-Pesa payment
    const mpesaResponse = await axios.post(`${API}/mpesa/initiate`, {
      phone: mpesaPhone,
      amount: totals.total,
      order_number: orderNumber,
    });

    if (mpesaResponse.data.ResponseCode === "0") {
      toast.info("STK Push sent to your phone. Please enter your M-Pesa PIN");
      
      // Poll for payment status (or use websockets for real-time updates)
      // For now, wait for callback to update order
      
      // Create order in pending state
      const orderData = {
        orderNumber,
        customer: customerInfo,
        delivery: deliveryInfo,
        items: cart.items,
        subtotal: totals.subtotal,
        giftWrapTotal: totals.giftWrapTotal,
        discount: 0,
        shippingCost: totals.shippingCost,
        total: totals.total,
        payment: {
          method: "M-Pesa",
          status: "pending",
          mpesaRequestId: mpesaResponse.data.CheckoutRequestID,
        },
        status: "pending",
      };

      await axios.post(`${API}/orders`, orderData);
      
      // Show waiting screen
      // Implement status polling or redirect to confirmation page
      
    } else {
      toast.error("Failed to initiate payment. Please try again.");
    }
  } catch (error) {
    console.error("Payment error:", error);
    toast.error("Payment failed. Please try again.");
  }

  setProcessingPayment(false);
};
```

---

## Step 6: Testing

### Sandbox Testing
1. Use Safaricom test credentials
2. Use test phone numbers provided by Safaricom
3. Test amounts: 1-100000 KES

### Production Checklist
- [ ] Obtain production credentials
- [ ] Update environment variables
- [ ] Set `MPESA_ENVIRONMENT=production`
- [ ] Configure SSL certificate for callback URL
- [ ] Test with small real transactions
- [ ] Monitor logs for any issues

---

## Error Handling

### Common Error Codes
- `1032`: Request cancelled by user
- `1037`: Timeout - user didn't enter PIN
- `2001`: Invalid initiator information
- `1`: Insufficient balance

### Retry Logic
Implement exponential backoff for failed requests:
```python
max_retries = 3
for attempt in range(max_retries):
    try:
        response = await mpesa_service.initiate_stk_push(...)
        break
    except Exception as e:
        if attempt == max_retries - 1:
            raise
        await asyncio.sleep(2 ** attempt)
```

---

## Security Best Practices

1. **Never expose credentials**: Keep all M-Pesa credentials in environment variables
2. **Validate callbacks**: Verify callback authenticity using IP whitelisting
3. **Use HTTPS**: All M-Pesa endpoints must use HTTPS
4. **Log securely**: Don't log sensitive customer data
5. **Rate limiting**: Implement rate limiting on payment endpoints
6. **Timeout handling**: Set appropriate timeouts (30s for STK push)

---

## Monitoring & Logging

### Key Metrics to Track
- Payment success rate
- Average payment completion time
- Failed payment reasons
- Callback response time

### Recommended Logging
```python
logger.info(f"Payment initiated: Order {order_number}, Amount {amount}")
logger.info(f"STK Push successful: CheckoutRequestID {checkout_request_id}")
logger.info(f"Payment confirmed: Receipt {mpesa_receipt_number}")
logger.error(f"Payment failed: {error_message}")
```

---

## Support Resources

- **Safaricom Developer Portal**: https://developer.safaricom.co.ke/
- **API Documentation**: https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate
- **Support Email**: apisupport@safaricom.co.ke
- **Developer Community**: https://developer.safaricom.co.ke/community

---

## Next Steps

1. Register for Safaricom Developer account
2. Get sandbox credentials and test
3. Apply for production credentials (takes 2-3 days)
4. Implement the code above
5. Test thoroughly in sandbox
6. Deploy to production
7. Monitor and optimize

---

**Questions?** Contact the Luxe Looks development team or refer to Safaricom's official documentation.
