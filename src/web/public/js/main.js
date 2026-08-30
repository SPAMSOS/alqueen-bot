// ========================================
// ALQUEEN - Landing Page Scripts
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Load real stats from API
    await loadRealStats();

    // Check if user is logged in - update nav
    await checkAuthAndUpdateNav();

    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

async function loadRealStats() {
    try {
        const res = await fetch('/api/public/stats');
        const { data } = await res.json();

        const stats = {
            guilds: data.guilds || 0,
            tickets: data.closedTickets || data.tickets || 0,
            satisfaction: data.satisfaction || 100
        };

        // Animate to real numbers
        animateToReal('1000', stats.guilds);
        animateToReal('50000', stats.tickets);
        animateToReal('99', stats.satisfaction);
    } catch (e) {
        console.error('Stats error:', e);
    }
}

function animateToReal(originalTarget, realValue) {
    const el = document.querySelector(`[data-target="${originalTarget}"]`);
    if (!el) return;
    el.dataset.target = realValue;
    const duration = 2000;
    const increment = realValue / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
        current += increment;
        if (current >= realValue) {
            el.textContent = formatNumber(realValue);
            clearInterval(timer);
        } else {
            el.textContent = formatNumber(Math.floor(current));
        }
    }, 16);
}

async function checkAuthAndUpdateNav() {
    try {
        const res = await fetch('/auth/me');
        if (res.status === 200) {
            const { data } = await res.json();
            replaceLoginButton(data);
        }
    } catch (e) {
        // Not logged in - keep default
    }
}

function replaceLoginButton(user) {
    const loginBtn = document.querySelector('a.btn-discord');
    if (!loginBtn) return;

    const avatarUrl = user.avatarUrl
        || (user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=64`
            : `https://cdn.discordapp.com/embed/avatars/${(parseInt(user.discriminator || '0') % 5)}.png?size=64`);

    const displayName = user.username || user.global_name || user.tag || 'حسابي';
    loginBtn.innerHTML = `<img src="${avatarUrl}" alt="" style="width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-left: 8px;"> لوحة التحكم`;
    loginBtn.href = '/dashboard';
    loginBtn.classList.remove('btn-discord');
    loginBtn.classList.add('btn-user-logged-in');
    loginBtn.style.cssText = 'background: rgba(88, 101, 242, 0.15); border: 1px solid rgba(88, 101, 242, 0.4); padding: 6px 14px; display: inline-flex; align-items: center; gap: 8px;';
}

function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                animateNumber(el, target);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });
    statNumbers.forEach(el => observer.observe(el));
}

function animateNumber(element, target) {
    const duration = 2000;
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = formatNumber(target);
            clearInterval(timer);
        } else {
            element.textContent = formatNumber(Math.floor(current));
        }
    }, 16);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}
