// ========================================
// ALQUEEN - Dashboard Scripts
// ========================================

class Dashboard {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentFilter = 'all';
        this.tickets = [];
        this.socket = null;

        this.init();
    }

    async init() {
        await this.loadUser();
        await this.loadStats();
        await this.loadTickets();
        this.setupSocket();
        this.setupEventListeners();
    }

    // Load user info
    async loadUser() {
        try {
            const response = await fetch('/auth/me');
            if (response.ok) {
                const { data } = await response.json();
                document.getElementById('userName').textContent = data.username || data.tag;
                document.getElementById('userAvatar').textContent = (data.username || 'U').charAt(0).toUpperCase();
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Failed to load user:', error);
        }
    }

    // Load bot stats
    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const { data } = await response.json();

            document.getElementById('totalTickets').textContent = this.formatNumber(data.tickets.total);
            document.getElementById('openTicketsCount').textContent = this.formatNumber(data.tickets.open);
            document.getElementById('closedTicketsCount').textContent = this.formatNumber(data.tickets.closed);
            document.getElementById('openTicketsBadge').textContent = data.tickets.open;
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    // Load tickets
    async loadTickets() {
        try {
            let url = `/api/tickets?limit=20&page=${this.currentPage}`;
            if (this.currentFilter !== 'all') {
                url += `&status=${this.currentFilter}`;
            }

            const response = await fetch(url);
            const { data, pagination } = await response.json();

            this.tickets = data;
            this.totalPages = pagination.pages;

            this.renderTickets();
            this.updatePagination(pagination);
        } catch (error) {
            console.error('Failed to load tickets:', error);
        }
    }

    // Render tickets table
    renderTickets() {
        const tbody = document.getElementById('ticketsTable');
        const emptyState = document.getElementById('emptyState');

        if (this.tickets.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        tbody.innerHTML = this.tickets.map(ticket => `
            <tr class="ticket-row" data-ticket-id="${ticket.ticketId}">
                <td><span class="ticket-id">${ticket.ticketId}</span></td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-sm">${this.getInitials(ticket.userTag)}</div>
                        <span>${ticket.userTag}</span>
                    </div>
                </td>
                <td>${ticket.subject || 'بدون عنوان'}</td>
                <td>
                    <span class="category-badge">
                        ${ticket.category?.emoji || '📁'} ${ticket.category?.name || 'أخرى'}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${ticket.status}">
                        ${this.getStatusLabel(ticket.status)}
                    </span>
                </td>
                <td>${this.formatDate(ticket.createdAt)}</td>
                <td>
                    <button class="filter-btn" onclick="dashboard.viewTicket('${ticket.ticketId}')">عرض</button>
                </td>
            </tr>
        `).join('');

        // Add click handlers
        tbody.querySelectorAll('.ticket-row').forEach(row => {
            row.addEventListener('click', () => {
                this.viewTicket(row.dataset.ticketId);
            });
        });
    }

    // View single ticket
    viewTicket(ticketId) {
        window.location.href = `/dashboard/ticket/${ticketId}`;
    }

    // Setup WebSocket for real-time updates
    setupSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to dashboard');
            this.socket.emit('joinGuild', 'all');
        });

        this.socket.on('ticketCreated', (data) => {
            this.showToast('تكت جديد!', `تم إنشاء تكت ${data.ticketId}`, 'success');
            this.loadTickets();
            this.loadStats();
        });

        this.socket.on('ticketMessage', (data) => {
            // Could update ticket preview without full reload
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from dashboard');
        });
    }

    // Setup event listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.currentPage = item.dataset.page;
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.currentPage = 1;
                this.loadTickets();
            });
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadTickets();
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadTickets();
            }
        });

        // Search
        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchTickets(e.target.value);
            }, 500);
        });
    }

    // Search tickets
    async searchTickets(query) {
        if (!query) {
            this.loadTickets();
            return;
        }

        try {
            const response = await fetch(`/api/tickets/search?q=${encodeURIComponent(query)}`);
            const { data } = await response.json();
            this.tickets = data;
            this.renderTickets();
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    // Update pagination info
    updatePagination(pagination) {
        const { total, page, pages } = pagination;
        const start = (page - 1) * 20 + 1;
        const end = Math.min(page * 20, total);

        document.getElementById('paginationInfo').textContent =
            `عرض ${start} - ${end} من ${total}`;

        document.getElementById('prevPage').disabled = page <= 1;
        document.getElementById('nextPage').disabled = page >= pages;
    }

    // Show toast notification
    showToast(title, message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <div class="toast-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // Utility functions
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    getInitials(tag) {
        return tag.split('#')[0].charAt(0).toUpperCase();
    }

    getStatusLabel(status) {
        const labels = {
            open: 'مفتوح',
            pending: 'قيد الانتظار',
            answered: 'تم الرد',
            closed: 'مغلق'
        };
        return labels[status] || status;
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Initialize dashboard
const dashboard = new Dashboard();
