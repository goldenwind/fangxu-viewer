import { EntitlementCache } from '../core/entitlement-cache.js';
import { membershipValidity, planComparison, priceText } from './helpers.js';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character]);

export class MembershipCenter extends EventTarget {
  constructor({ root, service, usage, config }) {
    super();
    this.root = root;
    this.service = service;
    this.usage = usage;
    this.config = config;
    this.cache = new EntitlementCache();
    this.account = null;
    this.status = null;
    this.plans = [];
    this.stage = 'plans';
    this.message = '';
    this.pendingPlan = null;
    this.pendingCode = null;
    this.currentOrder = null;
    this.generation = 0;
    this.dialog = null;
    this.build();
  }

  get isMember() {
    return Boolean(this.status?.is_vip);
  }

  async initialize() {
    if (!this.service.configured) {
      this.render();
      return;
    }
    const [accountResult, plansResult] = await Promise.allSettled([
      this.service.loadAccount(), this.service.plans(),
    ]);
    if (accountResult.status === 'fulfilled' && accountResult.value) {
      this.account = accountResult.value;
      this.status = this.cache.load(this.account);
    }
    if (plansResult.status === 'fulfilled') this.plans = plansResult.value?.list || [];
    else this.message = plansResult.reason.message;
    this.render();
    if (this.account) await this.restoreAccount();
  }

  build() {
    this.root.innerHTML = `
      <dialog class="membership-dialog" aria-label="会员中心">
        <div class="membership-shell">
          <aside class="member-rail">
            <div class="member-brand">${escapeHtml(this.config.brandName)} / MEMBER</div>
            <div class="member-rail-copy">
              <span class="eyebrow">FANGXU MEMBERSHIP</span>
              <h2>专注工作，<br />不被额度打断</h2>
              <p>${escapeHtml(this.config.memberBenefit)}</p>
              <ul><li>服务端校验会员权益</li><li>系统凭据安全保存账号</li><li>一次购买，不自动续费</li></ul>
            </div>
            <div class="quota-card" data-quota></div>
          </aside>
          <section class="member-content">
            <header class="member-header">
              <div><span class="eyebrow">MEMBERSHIP / 会员中心</span><h2 data-stage-title></h2></div>
              <button class="account-chip" data-account disabled></button>
              <button class="icon-button" data-close aria-label="关闭">×</button>
            </header>
            <p class="member-subtitle" data-subtitle></p>
            <div class="member-notice" data-message hidden></div>
            <div class="member-stage" data-stage></div>
            <footer class="member-footer" data-footer></footer>
          </section>
        </div>
      </dialog>`;
    this.dialog = this.root.querySelector('dialog');
    this.dialog.querySelector('[data-close]').addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
    });
    this.dialog.addEventListener('close', () => this.cancelPolling());
    this.dialog.querySelector('[data-account]').addEventListener('click', () => this.copyUserId());
    this.dialog.addEventListener('click', (event) => this.handleClick(event));
  }

  open(options = {}) {
    if (options.message) this.message = options.message;
    this.stage = 'plans';
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  close() {
    this.cancelPolling();
    if (this.dialog.open) this.dialog.close();
  }

  cancelPolling() {
    this.generation += 1;
  }

  async handleClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'back') this.backToPlans();
    if (action === 'login') await this.beginLogin();
    if (action === 'logout') await this.logout();
    if (action === 'refresh') await this.refreshStatus();
    if (action === 'activate-page') this.setStage('activate');
    if (action === 'activate') await this.activateCode();
    if (action === 'copy-login') await this.copyLoginCode(button.dataset.code);
    if (action === 'buy') await this.beginPurchase(this.plans[Number(button.dataset.index)]);
  }

  setStage(stage) {
    this.stage = stage;
    this.message = '';
    this.render();
  }

  backToPlans() {
    this.cancelPolling();
    this.pendingPlan = null;
    this.pendingCode = null;
    this.currentOrder = null;
    this.stage = 'plans';
    this.message = '';
    this.render();
  }

  notifyChanged() {
    this.dispatchEvent(new CustomEvent('entitlement-changed', { detail: { isMember: this.isMember } }));
  }

  async restoreAccount() {
    try {
      const account = await this.service.validate(this.account);
      this.account = account;
      await this.service.saveAccount(account);
      await this.refreshStatus();
    } catch (error) {
      if (error.unauthorized) await this.logout('登录已失效，请重新登录。');
    }
  }

  async refreshStatus({ afterPurchase = false } = {}) {
    if (!this.account) return false;
    for (let attempt = 0; attempt < (afterPurchase ? 5 : 1); attempt += 1) {
      try {
        const status = await this.service.status(this.account);
        this.status = status;
        this.cache.save(this.account, status);
        this.notifyChanged();
        if (status.is_vip) {
          if (afterPurchase) this.stage = 'success';
          this.render();
          return true;
        }
      } catch (error) {
        if (error.unauthorized) {
          await this.logout('登录已失效，请重新登录。');
          return false;
        }
        this.message = error.message;
      }
      if (afterPurchase) await sleep(1500);
    }
    this.render();
    return false;
  }

  async beginLogin() {
    const generation = ++this.generation;
    this.stage = 'login';
    this.message = '正在获取微信登录码…';
    this.render();
    try {
      const challenge = await this.service.challenge();
      if (generation !== this.generation) return;
      if (!challenge.token_id || !challenge.code) throw new Error('登录服务返回的数据不完整。');
      const deadline = Date.now() + 300_000;
      this.message = `请关注「${this.config.publicAccountName}」公众号并发送登录码。`;
      this.renderLogin(challenge.code, deadline);
      while (generation === this.generation && Date.now() < deadline) {
        const result = await this.service.loginStatus(challenge.token_id);
        if (result?.is_logged_in && result.user) {
          this.account = {
            userId: Number(result.user.user_id),
            username: result.user.username || '',
            apiToken: result.user.api_token,
          };
          await this.service.saveAccount(this.account);
          this.status = null;
          await this.refreshStatus();
          const pendingPlan = this.pendingPlan;
          const pendingCode = this.pendingCode;
          this.pendingPlan = null;
          this.pendingCode = null;
          if (pendingPlan) await this.beginPurchase(pendingPlan);
          else if (pendingCode) {
            this.stage = 'activate';
            this.render();
            this.dialog.querySelector('[data-activation-code]').value = pendingCode;
            await this.activateCode();
          } else this.setStage('plans');
          return;
        }
        await sleep(1000);
        this.renderLogin(challenge.code, deadline);
      }
      if (generation === this.generation) {
        this.message = '登录码已过期，请重新获取。';
        this.render();
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.message = error.message;
      this.render();
    }
  }

  async beginPurchase(plan) {
    if (!plan?.product_code) return;
    if (!this.account) {
      this.pendingPlan = plan;
      await this.beginLogin();
      return;
    }
    const generation = ++this.generation;
    this.stage = 'checkout';
    this.message = '正在创建订单…';
    this.currentOrder = { product_name: plan.name, actual_amount: plan.price };
    this.render();
    try {
      const order = await this.service.createOrder(this.account, plan.product_code);
      if (generation !== this.generation) return;
      if (!order?.order_no) throw new Error('订单数据不完整，请返回后重新下单。');
      this.message = `订单已创建，实付 ¥${priceText(order.actual_amount)}。请使用支付宝扫码付款。`;
      this.currentOrder = order;
      this.render();
      if (order.payment_status === 'PAID') {
        await this.finishPayment();
        return;
      }
      while (generation === this.generation) {
        await sleep(3000);
        const current = await this.service.order(this.account, order.order_no);
        this.currentOrder = { ...order, ...current };
        if (current.payment_status === 'PAID') {
          await this.finishPayment();
          return;
        }
        if (['EXPIRED', 'CANCELLED', 'CLOSED'].includes(current.order_status)) {
          this.message = '订单已结束，请返回方案重新选择。';
          this.render();
          return;
        }
      }
    } catch (error) {
      if (generation !== this.generation) return;
      if (error.unauthorized) {
        await this.logout('登录已失效，请重新登录后购买。');
        return;
      }
      this.message = error.message;
      this.render();
    }
  }

  async finishPayment() {
    this.message = '支付已确认，正在同步会员权益…';
    this.render();
    const synced = await this.refreshStatus({ afterPurchase: true });
    if (!synced) {
      this.message = '支付已确认，权益同步稍有延迟，请稍后刷新。';
      this.render();
    }
  }

  async activateCode() {
    const input = this.dialog.querySelector('[data-activation-code]');
    const code = input?.value.trim();
    if (!code) {
      this.message = '请输入激活码。';
      this.render();
      return;
    }
    if (!this.account) {
      this.pendingCode = code;
      await this.beginLogin();
      return;
    }
    this.pendingCode = code;
    this.message = '正在验证激活码…';
    this.render();
    try {
      const result = await this.service.redeemCode(this.account, code);
      if (Number(result.product_id) !== this.service.config.productId) {
        this.message = '激活码已兑换，但对应其他产品。请联系客服。';
        this.render();
        return;
      }
      this.pendingCode = null;
      this.message = '激活请求已提交，正在同步会员权益…';
      const synced = await this.refreshStatus({ afterPurchase: true });
      if (!synced) this.message = '激活成功，权益同步稍有延迟，请稍后刷新。';
      this.render();
    } catch (error) {
      if (error.unauthorized) {
        await this.logout('登录已失效，请重新登录后使用激活码。');
        return;
      }
      this.message = error.message;
      this.render();
    }
  }

  async logout(message = '') {
    this.cancelPolling();
    try { await this.service.clearAccount(); } catch { /* Already logged out locally. */ }
    this.cache.clear();
    this.account = null;
    this.status = null;
    this.stage = 'plans';
    this.message = message;
    this.notifyChanged();
    this.render();
  }

  async copyLoginCode(code) {
    await navigator.clipboard.writeText(code);
    this.message = '登录码已复制。';
    this.render();
  }

  async copyUserId() {
    if (!this.account) return;
    await navigator.clipboard.writeText(String(this.account.userId));
    this.message = `用户 ID ${this.account.userId} 已复制。`;
    this.render();
  }

  render() {
    if (!this.dialog) return;
    const titles = {
      plans: '选择适合你的方案', login: '完成微信登录', checkout: '确认订单并支付',
      success: '会员已开通', activate: '使用激活码开通会员',
    };
    this.dialog.querySelector('[data-stage-title]').textContent = titles[this.stage];
    this.dialog.querySelector('[data-subtitle]').textContent = {
      login: '登录后，会员权益会绑定到微信账号。', checkout: '请核对金额，再使用支付宝扫描付款码。',
      success: '感谢支持，会员权益已经同步到当前账号。', activate: '激活码将绑定当前账号。',
    }[this.stage] || '';
    const message = this.dialog.querySelector('[data-message]');
    message.textContent = this.message;
    message.hidden = !this.message;
    this.renderAccount();
    this.renderQuota();
    if (this.stage === 'plans') this.renderPlans();
    if (this.stage === 'login') this.renderLogin();
    if (this.stage === 'checkout') this.renderCheckout(this.currentOrder || {});
    if (this.stage === 'activate') this.renderActivation();
    if (this.stage === 'success') this.renderSuccess();
    this.renderFooter();
  }

  renderAccount() {
    const chip = this.dialog.querySelector('[data-account]');
    chip.disabled = !this.account;
    chip.textContent = this.account ? `${this.account.username || '用户'} · ID ${this.account.userId}` : '尚未登录';
  }

  renderQuota() {
    const target = this.dialog.querySelector('[data-quota]');
    if (!this.service.configured) {
      target.innerHTML = '<span>当前权益</span><strong>免费使用</strong><small>会员购买尚未配置</small>';
    } else if (this.isMember) {
      const [caption, validity] = membershipValidity(this.status);
      target.innerHTML = `<span>当前权益</span><strong>${escapeHtml(this.status.vip_level_name || '会员')}</strong><small>${escapeHtml(caption)}：${escapeHtml(validity)}</small>`;
    } else {
      target.innerHTML = `<span>当前权益</span><strong>本月剩余 ${this.usage.remaining} / ${this.usage.limit} 次</strong><small>免费额度按自然月重置</small>`;
    }
  }

  renderPlans() {
    const target = this.dialog.querySelector('[data-stage]');
    if (!this.service.configured) {
      target.innerHTML = '<div class="empty-state"><strong>会员功能尚未配置</strong><p>在 .env 中设置产品 ID 后，即可接入真实套餐与购买流程。</p></div>';
      return;
    }
    const cards = this.plans.map((plan, index) => {
      const comparison = planComparison(plan, this.plans);
      return `<article class="plan-card ${plan.recommended ? 'recommended' : ''}">
        <div><div class="plan-heading"><h3>${escapeHtml(plan.name || '会员')}</h3>${plan.badge ? `<span>${escapeHtml(plan.badge)}</span>` : ''}</div><p>${escapeHtml(plan.description || this.config.memberBenefit)}</p></div>
        <div class="plan-price">${comparison ? `<small>${escapeHtml(comparison[0])}</small>` : ''}<strong>¥${priceText(plan.price)}</strong>${comparison ? `<em>${escapeHtml(comparison[1])}</em>` : ''}</div>
        <button class="primary-button" data-action="buy" data-index="${index}">${plan.recommended ? '立即开通' : '选择'}</button>
      </article>`;
    }).join('');
    target.innerHTML = `${cards || '<div class="empty-state">暂无可购买套餐</div>'}
      <button class="activation-entry" data-action="activate-page">已有激活码？点击兑换</button>
      <p class="fine-print">价格以实际订单为准 · 支付宝扫码付款 · 无自动续费</p>`;
  }

  renderLogin(code = '', deadline = 0) {
    const target = this.dialog.querySelector('[data-stage]');
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    target.innerHTML = `<div class="login-layout">
      <div class="qr-frame"><img src="${escapeHtml(this.config.publicAccountQrUrl)}" alt="微信公众号二维码" /></div>
      <ol><li>用微信扫描左侧二维码</li><li>关注「${escapeHtml(this.config.publicAccountName)}」公众号</li><li>发送下方登录码</li></ol>
    </div>
    <button class="login-code" data-action="copy-login" data-code="${escapeHtml(code)}" ${code ? '' : 'disabled'}>${code ? `登录码 ${escapeHtml(code)} · 点击复制` : '正在获取登录码…'}</button>
    <p class="fine-print">${deadline ? `有效期 ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` : '登录码有效期 5 分钟'}</p>`;
  }

  renderCheckout(order) {
    const target = this.dialog.querySelector('[data-stage]');
    const payment = order.payment || {};
    const rawImage = payment.qr_code_image;
    const image = rawImage ? (rawImage.startsWith('data:') ? rawImage : `data:image/png;base64,${rawImage}`) : '';
    target.innerHTML = `<div class="checkout-layout">
      <div class="qr-frame payment-qr">${image ? `<img src="${escapeHtml(image)}" alt="支付宝付款码" />` : '<span>正在获取付款码…</span>'}</div>
      <div><span class="eyebrow">订单金额</span><h3>${escapeHtml(order.product_name || '会员')}</h3><div class="checkout-price">¥${priceText(order.actual_amount)}</div><p>打开支付宝扫描左侧付款码，支付完成后将自动开通。</p></div>
    </div>${payment.qr_code && !image ? `<details><summary>付款码无法显示？</summary><code>${escapeHtml(payment.qr_code)}</code></details>` : ''}
    <p class="fine-print">${order.order_no ? `订单号 ${escapeHtml(order.order_no)} · 正在自动确认支付状态` : '正在创建订单…'}</p>`;
  }

  renderActivation() {
    this.dialog.querySelector('[data-stage]').innerHTML = `<div class="activation-form"><label>激活码<input data-activation-code maxlength="128" placeholder="请输入激活码" value="${escapeHtml(this.pendingCode || '')}" /></label><p>激活后，会员时长以服务端返回的权益为准。</p><button class="primary-button" data-action="activate">立即激活</button></div>`;
  }

  renderSuccess() {
    const [caption, validity] = membershipValidity(this.status);
    this.dialog.querySelector('[data-stage]').innerHTML = `<div class="success-state"><div class="success-mark">✓</div><h3>开通成功</h3><div class="status-card"><span>当前会员权益</span><strong>${escapeHtml(this.status?.vip_level_name || '会员')}</strong><span>${escapeHtml(caption)}</span><strong>${escapeHtml(validity)}</strong></div><p>${escapeHtml(this.config.memberBenefit)}</p></div>`;
  }

  renderFooter() {
    const footer = this.dialog.querySelector('[data-footer]');
    const back = ['login', 'checkout', 'activate'].includes(this.stage) ? '<button class="quiet-button" data-action="back">返回方案</button>' : '';
    const login = !this.account && ['plans', 'login'].includes(this.stage) && this.service.configured ? '<button class="primary-button" data-action="login">微信登录</button>' : '';
    const refresh = this.account && ['plans', 'success'].includes(this.stage) ? '<button data-action="refresh">刷新会员状态</button>' : '';
    const logout = this.account ? '<button class="quiet-button" data-action="logout">退出登录</button>' : '';
    footer.innerHTML = `${back}<span></span>${login}${refresh}${logout}`;
  }
}
