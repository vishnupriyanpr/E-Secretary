/**
 * E-Secretary | Stunning Blue Theme
 * Interactive Premium Design
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initInfiniteGrid();
    initGridDensityControl();
    initGridDensityControl();
    initButtonEffects();
    initSmoothScroll();
    initScrollReveal();
    initFeatureSlider();
    initFeatureSlider();
    initTimeline();
    initInteractiveButtons();
    initTestimonials();
    initMouseFollower();
    initTextRoll();
    initIntegrations();
});

/**
 * Feature Slider - Testimonial Style
 */
function initFeatureSlider() {
    const features = [
        {
            badge: "Unified Inbox",
            headline: "All your emails, messages, and meetings in one intelligent feed.",
            desc: "Gmail, Slack, Teams, and notifications unified with AI-powered action extraction.",
            title: "Unified Inbox",
            subtitle: "Core Feature"
        },
        {
            badge: "Meeting Intelligence",
            headline: "Auto-transcribe and summarize every meeting instantly.",
            desc: "Never miss action items again. AI extracts key points and follow-ups automatically.",
            title: "Meeting Intelligence",
            subtitle: "AI Powered"
        },
        {
            badge: "Smart Tasks",
            headline: "AI identifies action items and organizes by priority.",
            desc: "Tasks extracted from conversations, emails, and meetings. Prioritized automatically.",
            title: "Smart Tasks",
            subtitle: "Automation"
        },
        {
            badge: "Priority Alerts",
            headline: "Smart notifications that know when to interrupt.",
            desc: "Focus mode, smart filtering, and context-aware notifications that respect your time.",
            title: "Priority Alerts",
            subtitle: "Smart Filter"
        },
        {
            badge: "Time Analytics",
            headline: "Understand where your time goes every single day.",
            desc: "Track meeting load, focus hours, and communication patterns with visual insights.",
            title: "Time Analytics",
            subtitle: "Insights"
        },
        {
            badge: "Enterprise Security",
            headline: "SOC 2 Type II certified. Your data stays yours.",
            desc: "End-to-end encryption, SSO, and compliance controls for enterprise teams.",
            title: "Enterprise Security",
            subtitle: "Compliance"
        }
    ];

    let currentIndex = 0;
    let autoPlayTimer = null;

    const oversizedNumber = document.getElementById('oversizedNumber');
    const progressFill = document.getElementById('progressFill');
    const featureBadge = document.getElementById('featureBadge');
    const featureHeadline = document.getElementById('featureHeadline');
    const featureDesc = document.getElementById('featureDesc');
    const metaTitle = document.getElementById('metaTitle');
    const metaSubtitle = document.getElementById('metaSubtitle');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (!oversizedNumber || !progressFill) return;

    function updateFeature(index, direction = 1) {
        const feature = features[index];

        // Animate out number
        oversizedNumber.classList.add('changing');

        // Animate headline exit
        featureHeadline.classList.add('exiting');

        setTimeout(() => {
            // Update number
            oversizedNumber.textContent = String(index + 1).padStart(2, '0');
            oversizedNumber.classList.remove('changing');

            // Update badge
            featureBadge.querySelector('.badge-text').textContent = feature.badge;

            // Update headline with word spans
            const words = feature.headline.split(' ');
            featureHeadline.innerHTML = words.map(word =>
                `<span class="word">${word}</span>`
            ).join('');
            featureHeadline.classList.remove('exiting');

            // Update description
            featureDesc.textContent = feature.desc;
            featureDesc.style.animation = 'none';
            featureDesc.offsetHeight; // Trigger reflow
            featureDesc.style.animation = 'fadeIn 0.5s ease 0.5s forwards';

            // Update meta
            metaTitle.textContent = feature.title;
            metaSubtitle.textContent = feature.subtitle;

            // Update progress
            progressFill.style.height = `${((index + 1) / features.length) * 100}%`;
        }, 300);
    }

    function goNext() {
        currentIndex = (currentIndex + 1) % features.length;
        updateFeature(currentIndex, 1);
        resetAutoPlay();
    }

    function goPrev() {
        currentIndex = (currentIndex - 1 + features.length) % features.length;
        updateFeature(currentIndex, -1);
        resetAutoPlay();
    }

    function resetAutoPlay() {
        if (autoPlayTimer) clearInterval(autoPlayTimer);
        autoPlayTimer = setInterval(goNext, 6000);
    }

    // Event listeners
    if (nextBtn) nextBtn.addEventListener('click', goNext);
    if (prevBtn) prevBtn.addEventListener('click', goPrev);

    // Start auto-play
    resetAutoPlay();
}

/**
 * Interactive Hover Buttons
 * Automatically upgrades .btn-primary, .btn-secondary, .btn-header with interactive structure
 */
function initInteractiveButtons() {
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-header');

    buttons.forEach(btn => {
        // Prevent double initialization
        if (btn.querySelector('.btn-original-content')) return;

        const originalText = btn.innerHTML;
        const buttonText = btn.textContent.trim();

        // New Structure
        btn.innerHTML = `
            <span class="btn-original-content">
                ${originalText}
            </span>
            <div class="btn-bg-fill"></div>
            <div class="btn-hover-content">
                <span>${buttonText}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"/>
                    <path d="m12 5 7 7-7 7"/>
                </svg>
            </div>
        `;
    });
}


/**
 * Scroll Reveal Animations
 */
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    reveals.forEach(el => observer.observe(el));
}

/**
 * Infinite Scroll Testimonials
 * Populates 3 columns with E-Secretary specific stories and duplicates for loop
 */
function initTestimonials() {
    const testimonials = [
        {
            text: "This AI summarizer is magic. I used to spend 2 hours a week sorting meeting notes. Now it's instant.",
            name: "Sarah Jenkins",
            role: "Product Manager",
            img: "https://randomuser.me/api/portraits/women/12.jpg"
        },
        {
            text: "Finally, a tool that unifies Slack and Gmail. I don't constantly switch tabs anymore. My focus has doubled.",
            name: "David Chen",
            role: "Tech Lead",
            img: "https://randomuser.me/api/portraits/men/32.jpg"
        },
        {
            text: "The prioritization feature is scary good. It flags urgent client emails before I even open my inbox.",
            name: "Amanda Low",
            role: "Sales Director",
            img: "https://randomuser.me/api/portraits/women/44.jpg"
        },
        {
            text: "E-Secretary's daily briefing is my morning coffee. It tells me exactly what I need to do today.",
            name: "Marcus Johnson",
            role: "CEO",
            img: "https://randomuser.me/api/portraits/men/86.jpg"
        },
        {
            text: "Security was our main concern, but the enterprise-grade encryption checked every box for our IT team.",
            name: "Elena Rodriguez",
            role: "CTO",
            img: "https://randomuser.me/api/portraits/women/65.jpg"
        },
        {
            text: "The action item extraction is precise. It catches things I promised in meetings weeks ago.",
            name: "Tom Baker",
            role: "Project Lead",
            img: "https://randomuser.me/api/portraits/men/22.jpg"
        },
        {
            text: "I love the 'Boxy' UI. It feels fast, modern, and the dark mode is perfect for late night work.",
            name: "Jessica Wu",
            role: "Designer",
            img: "https://randomuser.me/api/portraits/women/33.jpg"
        },
        {
            text: "Implementation took 10 minutes. It connected to our Office 365 and Slack instantly.",
            name: "Ryan Park",
            role: "Ops Manager",
            img: "https://randomuser.me/api/portraits/men/54.jpg"
        },
        {
            text: "Customer support is top notch. They helped us configure custom routing rules for our support tickets.",
            name: "Lisa Thompson",
            role: "Support Lead",
            img: "https://randomuser.me/api/portraits/women/28.jpg"
        }
    ];

    const grid = document.getElementById('testimonialsGrid');
    if (!grid) return;

    // Split into 3 columns
    const columns = [[], [], []];
    testimonials.forEach((t, i) => columns[i % 3].push(t));

    // Durations for each column (marquee effect)
    const durations = [45, 55, 50]; // Slower speeds for readability

    columns.forEach((colData, colIndex) => {
        const colDiv = document.createElement('div');
        colDiv.className = 'testim-col';

        // Wrapper for overflow hidden
        const wrapper = document.createElement('div');
        wrapper.className = 'testim-wrapper';
        wrapper.style.overflow = 'hidden';
        wrapper.style.height = '100%';

        // The moving element
        const mover = document.createElement('div');
        mover.className = 'testim-mover';
        mover.style.animation = `verticalScroll ${durations[colIndex]}s linear infinite`;

        // Generate Cards HTML
        const createCards = (items) => items.map(t => `
            <div class="testim-card">
                <p class="testim-text">"${t.text}"</p>
                <div class="testim-user">
                    <img src="${t.img}" alt="${t.name}" class="testim-avatar">
                    <div class="testim-info">
                        <span class="testim-name">${t.name}</span>
                        <span class="testim-role">${t.role}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // DUPLICATE CONTENT FOR INFINITE LOOP
        // We add the same items twice. The animation moves -50% (exactly half).
        mover.innerHTML = createCards(colData) + createCards(colData);

        wrapper.appendChild(mover);
        colDiv.appendChild(wrapper);
        grid.appendChild(colDiv);
    });
}


/**
 * Translucent Header - Scroll Effect
 */
function initHeader() {
    const header = document.getElementById('header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }, { passive: true });
}

/**
 * Mouse Follower for Spotlight Effects
 */
function initMouseFollower() {
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;

        document.documentElement.style.setProperty('--mouse-x', x + 'px');
        document.documentElement.style.setProperty('--mouse-y', y + 'px');
    });
}

/**
 * Text Roll Animation (Ported from React)
 * Splits text into characters for staggered hover/load effects.
 */
function initTextRoll() {
    // 1. Hover Effect Targets (Header Links & Logo)
    const hoverTargets = document.querySelectorAll('.header-nav a, .logo-text-only');
    hoverTargets.forEach(el => wrapCharacters(el, 'hover'));

    // 2. Load Effect Targets (Headings)
    // Exclude hero-subtitle as it has HTML inside
    const loadTargets = document.querySelectorAll('.hero-title, .section-title');
    loadTargets.forEach(el => {
        // Only if text only (no nested HTML structure like breaks unless handled)
        // For hero-title which has <br> and spans, we might need a more robust approach
        // simplified here: apply only to text nodes or specific spans if needed.
        // For now, let's target the immediate text content if simple, or skip complex ones.

        // Actually, for .hero-title, it has HTML. Let's skip it or handle manually.
        // Let's stick to .section-title which is usually simple text.
        wrapCharacters(el, 'load');
    });

    // Special handling for Hero Title (Complex HTML)
    // We can target the span ".text-gradient" separately if we want, or the main text.
}

function wrapCharacters(element, type) {
    // Avoid double init
    if (element.classList.contains('roll-init')) return;
    element.classList.add('roll-init');

    const originalText = element.textContent.trim();
    const text = element.innerText; // Get visible text
    // For complex elements, this might destroy HTML. 
    // Ideally we only do this for leaf nodes. 

    // Safe check: if element has child elements (like <br> or <span>), 
    // we should allow the user to specify a data-attribute or target leaf nodes.
    // For this demo, let's assume we replace the content effectively.

    // Special case: Header links are simple text. Safe.
    // Special case: Section titles are simple text. Safe.
    // Special case: Hero title has <br> and span. 
    // FIX: If element children length > 0, don't replace markup, animate children instead?
    // Let's implement a safe mode: Only replace if no element children.
    if (element.children.length > 0 && type !== 'hover') {
        // If it's a complex heading, maybe look for text nodes? 
        // For now, let's skip complex headers to avoid breaking layout.
        return;
    }

    const chars = originalText.split('');
    const stagger = 0.035;

    // Create Container
    const container = document.createElement('span');
    container.className = `roll-container ${type}-type`;

    // Create Top Line (Visible)
    const lineTop = document.createElement('span');
    lineTop.className = 'roll-line top';

    // Create Bottom Line (Hidden/Absolute) - Only for Hover
    let lineBottom = null;
    if (type === 'hover') {
        lineBottom = document.createElement('span');
        lineBottom.className = 'roll-line bottom';
    }

    chars.forEach((char, i) => {
        // Replace space with non-breaking space for layout
        const safeChar = char === ' ' ? '&nbsp;' : char;
        const delay = i * stagger;

        // Top Char
        const spanTop = document.createElement('span');
        spanTop.className = 'roll-char';
        spanTop.innerHTML = safeChar;
        spanTop.style.transitionDelay = `${delay}s`;
        lineTop.appendChild(spanTop);

        // Bottom Char (Hover only)
        if (lineBottom) {
            const spanBottom = document.createElement('span');
            spanBottom.className = 'roll-char';
            spanBottom.innerHTML = safeChar;
            spanBottom.style.transitionDelay = `${delay}s`;
            lineBottom.appendChild(spanBottom);
        }
    });

    container.appendChild(lineTop);
    if (lineBottom) container.appendChild(lineBottom);

    // Replace Content
    element.innerHTML = '';
    element.appendChild(container);

    // Trigger Load Animation
    if (type === 'load') {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    container.classList.add('animated');
                    observer.unobserve(entry.target);
                }
            });
        });
        observer.observe(element);
    }
}


/**
 * Smooth Scroll for Navigation
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const headerHeight = document.getElementById('header')?.offsetHeight || 80;
                const top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

/**
 * Infinite Grid with Mouse Reveal Effect
 * Exact implementation from React component
 */
function initInfiniteGrid() {
    const heroSection = document.getElementById('heroSection');
    const gridHighlight = document.getElementById('gridHighlight');
    const gridBase = document.getElementById('gridBase');
    const patternBase = document.getElementById('grid-pattern-base');
    const patternHighlight = document.getElementById('grid-pattern-highlight');

    if (!heroSection || !gridHighlight) return;

    let gridSize = 40;
    let gridOffsetX = 0;
    let gridOffsetY = 0;
    const speedX = 0.5;
    const speedY = 0.5;

    // Mouse tracking for "flashlight" reveal effect
    heroSection.addEventListener('mousemove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Update the radial gradient mask to follow mouse
        const maskImage = `radial-gradient(300px circle at ${mouseX}px ${mouseY}px, black, transparent)`;
        gridHighlight.style.webkitMaskImage = maskImage;
        gridHighlight.style.maskImage = maskImage;
    });

    // Infinite scrolling grid animation
    function animateGrid() {
        gridOffsetX = (gridOffsetX + speedX) % gridSize;
        gridOffsetY = (gridOffsetY + speedY) % gridSize;

        if (patternBase) {
            patternBase.setAttribute('x', gridOffsetX);
            patternBase.setAttribute('y', gridOffsetY);
        }
        if (patternHighlight) {
            patternHighlight.setAttribute('x', gridOffsetX);
            patternHighlight.setAttribute('y', gridOffsetY);
        }

        requestAnimationFrame(animateGrid);
    }

    animateGrid();

    // Expose updateGridSize for the control panel
    window.updateGridSize = (newSize) => {
        gridSize = newSize;

        if (patternBase) {
            patternBase.setAttribute('width', newSize);
            patternBase.setAttribute('height', newSize);
            patternBase.querySelector('path').setAttribute('d', `M ${newSize} 0 L 0 0 0 ${newSize}`);
        }
        if (patternHighlight) {
            patternHighlight.setAttribute('width', newSize);
            patternHighlight.setAttribute('height', newSize);
            patternHighlight.querySelector('path').setAttribute('d', `M ${newSize} 0 L 0 0 0 ${newSize}`);
        }
    };
}

/**
 * Grid Density Control Panel
 */
function initGridDensityControl() {
    const slider = document.getElementById('gridDensity');
    const densityValue = document.getElementById('densityValue');

    if (!slider || !densityValue) return;

    slider.addEventListener('input', (e) => {
        const value = e.target.value;
        densityValue.textContent = `Sparse (${value}px)`;

        if (window.updateGridSize) {
            window.updateGridSize(Number(value));
        }
    });
}



/**
 * Button Hover Effects (Spring animation like Framer Motion)
 */
function initButtonEffects() {
    const btnPrimary = document.getElementById('btnPrimary');
    const btnSecondary = document.getElementById('btnSecondary');

    const applySpringEffect = (btn) => {
        if (!btn) return;

        btn.addEventListener('mouseenter', () => {
            btn.style.transition = 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transition = 'all 0.15s ease';
        });
    };

    applySpringEffect(btnPrimary);
    applySpringEffect(btnSecondary);
}

/**
 * Form Submission Handler
 */




/**
 * Timeline - Scroll Progress & Active States
 */
function initTimeline() {
    const section = document.querySelector('.timeline-section');
    const container = document.querySelector('.timeline-container');
    const progressLine = document.querySelector('.timeline-line-progress');
    const items = document.querySelectorAll('.timeline-item');

    if (!section || !container || !progressLine) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateTimelineProgress();
                ticking = false;
            });
            ticking = true;
        }
    });

    function updateTimelineProgress() {
        // 1. Calculate Progress Line Height
        const containerRect = container.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Start filling when container enters the bottom 20% of the screen (earlier start)
        // Was 0.4 (40%), changing to 0.75 (75%) so it starts filling as soon as section is visible
        const startOffset = windowHeight * 0.75;

        // Distance scrolled past the start point
        let progress = startOffset - containerRect.top;

        // Max height is container height
        const maxProgress = containerRect.height;

        // Clamp value between 0 and max
        let currentHeight = Math.max(0, Math.min(progress, maxProgress));

        // Update line height
        progressLine.style.height = `${currentHeight}px`;

        // 2. Activate Items
        items.forEach((item, index) => {
            const itemRect = item.getBoundingClientRect();
            // Trigger active state when item is in the bottom quarter (sooner)
            // Was 0.5 (center), changing to 0.8 (bottom area)
            // Special case for first item: make it activate even sooner if section is visible
            let triggerPoint = windowHeight * 0.8;

            if (index === 0) {
                // First item activates almost immediately when section enters
                triggerPoint = windowHeight * 0.95;
            }

            if (itemRect.top < triggerPoint) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Initial call
    updateTimelineProgress();
}

/**
 * Integrations Marquee Logic
 */
function initIntegrations() {
    const row1Container = document.getElementById('marqueeRow1');
    const row2Container = document.getElementById('marqueeRow2');

    if (!row1Container || !row2Container) return;

    // Row 1: Primary Communication & Scheduling (13 Apps)
    const iconsRow1 = [
        "https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg", // Slack
        "https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg", // Teams
        "https://cdn.worldvectorlogo.com/logos/gmail-icon-2020.svg", // Gmail
        "https://cdn.worldvectorlogo.com/logos/microsoft-outlook-office-365.svg", // Outlook
        "https://cdn.worldvectorlogo.com/logos/whatsapp-symbol.svg", // WhatsApp
        "https://cdn.worldvectorlogo.com/logos/zoom-app-icon.svg", // Zoom
        "https://cdn.worldvectorlogo.com/logos/google-meet-icon-2020.svg", // Google Meet
        "https://cdn.worldvectorlogo.com/logos/google-calendar-icon-2020.svg", // Google Calendar
        "https://cdn.worldvectorlogo.com/logos/calendly.svg", // Calendly
        "https://cdn.worldvectorlogo.com/logos/telegram-1.svg", // Telegram
        "https://cdn.worldvectorlogo.com/logos/webex-1.svg", // Webex
        "https://cdn.worldvectorlogo.com/logos/signal-logo.svg", // Signal
        "https://cdn.worldvectorlogo.com/logos/yammer-1.svg" // Viva Engage (Yammer rebrand, falling back to reliable icon)
    ];

    // Row 2: Management, CRM & Collaboration (13 Apps)
    const iconsRow2 = [
        "https://cdn.worldvectorlogo.com/logos/jira-3.svg", // Jira
        "https://cdn.worldvectorlogo.com/logos/linear-app-logo.svg", // Linear
        "https://cdn.worldvectorlogo.com/logos/asana-logo.svg", // Asana
        "https://cdn.worldvectorlogo.com/logos/trello-logo-1.svg", // Trello
        "https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg", // Notion (Wiki is usually fine for this simple one)
        "https://cdn.worldvectorlogo.com/logos/hubspot-1.svg", // HubSpot
        "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg", // Salesforce
        "https://cdn.worldvectorlogo.com/logos/intercom-2.svg", // Intercom
        "https://cdn.worldvectorlogo.com/logos/zendesk-1.svg", // Zendesk
        "https://cdn.worldvectorlogo.com/logos/discord-6.svg", // Discord
        "https://cdn.worldvectorlogo.com/logos/monday-1.svg", // Monday
        "https://cdn.worldvectorlogo.com/logos/clickup-logo.svg", // ClickUp
        "https://cdn.worldvectorlogo.com/logos/basecamp-1.svg" // Basecamp
    ];

    // Helper: Duplicate array for infinite scroll smoothness
    const repeatCount = 3; // Adjusted for 26 icons
    const allIcons1 = Array(repeatCount).fill(iconsRow1).flat();
    const allIcons2 = Array(repeatCount).fill(iconsRow2).flat();

    // Render Function
    const renderIcons = (container, icons) => {
        container.innerHTML = icons.map(src => {
            // Apply a brighter background for apps with dark/black logos to ensure visibility
            const lowerSrc = src.toLowerCase();
            const needsHighlight = [
                'asana', 'zendesk', 'notion', 'basecamp', 'linear', 'monday', 'github'
            ].some(app => lowerSrc.includes(app));

            const highlightClass = needsHighlight ? 'highlight-white' : '';

            return `
            <div class="integration-card ${highlightClass}">
                <img src="${src}" alt="App Integration" loading="lazy" onerror="this.parentElement.style.display='none'">
            </div>
            `;
        }).join('');
    };

    renderIcons(row1Container, allIcons1);
    renderIcons(row2Container, allIcons2);
}

/* ========================================
   VISUAL OVERHAUL & "MAGNIFICENCE"
   ======================================== */
function initVisualEnhancements() {
    // 1. "Enlightened" Spotlight Effect
    const body = document.body;

    // Only activate spotlight on desktop/mouse devices to save mobile battery
    if (window.matchMedia("(hover: hover)").matches) {
        document.addEventListener('mousemove', (e) => {
            requestAnimationFrame(() => {
                body.style.setProperty('--mouse-x', `${e.clientX}px`);
                body.style.setProperty('--mouse-y', `${e.clientY}px`);

                if (!body.classList.contains('spotlight-active')) {
                    body.classList.add('spotlight-active');
                }
            });
        });
    }

    // 2. Global Scroll Reveals (IntersectionObserver)
    const observerOptions = {
        threshold: 0.15, // Trigger when 15% visible
        rootMargin: "0px 0px -50px 0px" // Trigger slightly before bottom
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                revealObserver.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    // Select elements to reveal
    const revealElements = document.querySelectorAll('.reveal-up, .section-header, .feature-card, .step-item, .testimonial-card');
    revealElements.forEach(el => {
        el.classList.add('reveal-up'); // Ensure class exists
        revealObserver.observe(el);
    });

    // 3. Parallax Effects
    const heroBg = document.querySelector('.hero-bg');
    const heroContent = document.querySelector('.hero-content');

    if (heroBg) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            // Parallax: Background moves slower than foreground
            if (scrolled < window.innerHeight) {
                heroBg.style.transform = `translateY(${scrolled * 0.4}px)`;
                if (heroContent) {
                    heroContent.style.transform = `translateY(${scrolled * 0.1}px)`;
                    heroContent.style.opacity = 1 - (scrolled / 700);
                }
            }
        });
    }
}

// Initialize Visuals
document.addEventListener('DOMContentLoaded', initVisualEnhancements);
