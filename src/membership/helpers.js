export function priceText(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  return amount.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function planKind(plan) {
  const code = String(plan.product_code || '').toUpperCase();
  const name = String(plan.name || '');
  if (code.endsWith('_MONTH') || name.includes('月度')) return 'month';
  if (code.endsWith('_YEAR') || name.includes('年度')) return 'year';
  if (code.endsWith('_LIFETIME') || name.includes('终身')) return 'lifetime';
  return '';
}

export function planComparison(plan, plans) {
  const price = Number(plan.price);
  const original = Number(plan.original_price || 0);
  if (Number.isFinite(original) && original > price && price > 0) {
    return [`原价 ¥${priceText(original)}`, `立省 ¥${priceText(original - price)}`];
  }
  const references = {
    year: ['month', 12, '按月购买 12 个月'],
    lifetime: ['year', 3, '按年购买 3 年'],
  };
  const comparison = references[planKind(plan)];
  if (!comparison || !Number.isFinite(price) || price <= 0) return null;
  const [referenceKind, count, label] = comparison;
  const reference = plans.find((item) => planKind(item) === referenceKind);
  const comparisonPrice = Number(reference?.price) * count;
  if (!Number.isFinite(comparisonPrice) || comparisonPrice <= price) return null;
  return [`${label} ¥${priceText(comparisonPrice)}`, `省 ¥${priceText(comparisonPrice - price)}`];
}

export function membershipValidity(status) {
  if (status?.expired_at) {
    const date = new Date(status.expired_at);
    if (!Number.isNaN(date.getTime())) {
      const parts = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
      return ['到期时间', `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`];
    }
    return ['到期时间', String(status.expired_at)];
  }
  if (status?.vip_type === 'lifetime') return ['会员有效期', '永久有效 · 无到期时间'];
  return ['到期时间', '暂未获取，请刷新会员状态'];
}
