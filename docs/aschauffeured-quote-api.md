# ASChauffeured Instant Quote API

## Overview
实时获取报价，无需登录，直接嵌入官网。  
租户更新定价/车型/附加费后立即生效。

## Base URL
`https://chauffeur-saas-production.up.railway.app`

## Endpoints

### 1. Get Quote
`GET /public/quote`

#### Parameters

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| tenant_slug | ✅ | string | 固定值：`aschauffeured` |
| service_type | ✅ | string | 见下方服务类型 |
| pickup_datetime | 推荐 | string | ISO 8601格式，影响时段/节假日附加费 |
| distance_km | 可选 | number | 行程距离（公里） |
| duration_hours | 可选 | number | 小时数（Hourly Charter用） |
| duration_minutes | 可选 | number | 分钟数（DT计费用） |
| promo_code | 可选 | string | 优惠码 |

#### Service Types

| 值 | 说明 |
|----|------|
| POINT_TO_POINT | 点对点 |
| HOURLY_CHARTER | 包车按小时 |
| AIRPORT_PICKUP | 接机 |
| AIRPORT_DROPOFF | 送机 |

#### Example Request

```http
GET /public/quote?
  tenant_slug=aschauffeured
  &service_type=POINT_TO_POINT
  &pickup_datetime=2026-03-01T10:00:00
  &distance_km=15
  &duration_minutes=25
```

#### Example Response

```json
{
  "tenant": {
    "slug": "aschauffeured",
    "name": "AS Chauffeured"
  },
  "service_type": "POINT_TO_POINT",
  "distance_km": 15,
  "duration_hours": 0,
  "quotes": [
    {
      "vehicle_type_id": "24fad38e-...",
      "type_name": "Mercedes-Benz V-CLASS",
      "description": null,
      "max_luggage": 3,
      "max_passengers": 4,
      "currency": "AUD",
      "estimated_fare": 120.00,
      "billing_options": [
        {
          "method": "KM",
          "fare": 120.00,
          "label": "15km × $3.00/km"
        },
        {
          "method": "DT",
          "fare": 112.50,
          "label": "25min × $1.50/min"
        }
      ],
      "surcharges_applied": []
    }
  ]
}
```

### 2. Validate Promo Code
`GET /public/promo-code/validate`

#### Parameters

| 参数 | 必填 | 说明 |
|-----------|--|-------------------|
| tenant_slug | ✅ | 固定值：`aschauffeured` |
| code | ✅ | 优惠码（大小写不敏感） |

#### Example Response（有效）

```json
{
  "valid": true,
  "code": "WELCOME10",
  "discount_type": "PERCENTAGE",
  "discount_value": 10
}
```

#### Example Response（无效）

```json
{
  "valid": false,
  "message": "Invalid or expired promo code"
}
```

## 官网嵌入预订跳转
用户在官网选好车型后，跳转到预订页面：

```text
https://book.aschauffeured.com.au/book?
  service_type=POINT_TO_POINT
  &vehicle_type_id={vehicle_type_id}
  &estimated_fare={estimated_fare}
  &distance_km={distance_km}
  &duration_minutes={duration_minutes}
  &pickup_datetime={pickup_datetime}
  &pickup_address={encoded_address}
  &dropoff_address={encoded_address}
```

所有参数会自动填入预订表单，用户无需重新输入。

## JavaScript 示例代码

```javascript
async function getQuote({ serviceType, distanceKm, durationMinutes, pickupDatetime, promoCode }) {
  const params = new URLSearchParams({
    tenant_slug: 'aschauffeured',
    service_type: serviceType,
    distance_km: distanceKm,
    duration_minutes: durationMinutes,
    pickup_datetime: pickupDatetime,
    ...(promoCode && { promo_code: promoCode }),
  });

  const res = await fetch(
    `https://chauffeur-saas-production.up.railway.app/public/quote?${params}`
  );
  const data = await res.json();
  return data.quotes;
}

// 使用示例
const quotes = await getQuote({
  serviceType: 'POINT_TO_POINT',
  distanceKm: 15,
  durationMinutes: 25,
  pickupDatetime: '2026-03-01T10:00:00',
});

quotes.forEach(q => {
  console.log(`${q.type_name}: AUD $${q.estimated_fare}`);
  q.billing_options.forEach(opt => {
    console.log(` ${opt.method}: $${opt.fare} (${opt.label})`);
  });
});

// 用户选好后跳转预订
function redirectToBooking(quote, selectedMethod) {
  const option = quote.billing_options
    .find(o => o.method === selectedMethod) ?? quote.billing_options[0];

  const params = new URLSearchParams({
    service_type: 'POINT_TO_POINT',
    vehicle_type_id: quote.vehicle_type_id,
    estimated_fare: option.fare,
    distance_km: 15,
    billing_method: option.method,
  });

  window.location.href = `https://book.aschauffeured.com.au/book?${params}`;
}
```

## 注意事项
1. 价格实时性：租户更新定价后立即生效，无需重新部署官网  
2. 附加费自动计算：时段/节假日/服务类型附加费自动包含在报价中  
3. 计费方式：如果 `billing_options` 有多个选项，建议让用户选择  
4. 最低消费：报价已包含最低消费限制  
5. 货币：所有价格单位为 AUD（澳元）
