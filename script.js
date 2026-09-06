// Centralized scripts for site-wide behavior
console.log("Shree Vidya Tax Consultancy Website Loaded 🚀");

function goTo(id) {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    } else {
        // If the section isn't on this page, navigate to the homepage with a hash
        const current = window.location.pathname.split('/').pop() || 'index.html';
        if (current === 'index.html' || current === '') {
            console.warn('Section not found on this page:', id);
        } else {
            window.location.href = 'index.html#' + id;
        }
    }
}

function selectService(serviceName) {
    // open the submission modal and prefll service
    const modal = document.getElementById('submission-modal');
    const title = document.getElementById('modal-title');
    const svc = document.getElementById('modal-service');
    const hidden = document.getElementById('form-service');
    if (modal && svc && hidden) {
        title.textContent = 'Submit Documents';
        svc.textContent = 'Service: ' + serviceName;
        hidden.value = serviceName;
        modal.setAttribute('aria-hidden','false');
        // reset form visibility
        document.getElementById('submission-form').hidden = false;
        document.getElementById('scan-screen').hidden = true;
        document.getElementById('submit-success').hidden = true;
        document.getElementById('submit-error').hidden = true;
        // focus first input
        document.getElementById('form-name').focus();
    } else {
        // fallback
        alert(serviceName + " selected. Please visit the counter or contact us for assistance.");
        goTo('contact');
    }
}

// Setup modal behaviors and submission handling
function setupSubmissionModal(){
    const modal = document.getElementById('submission-modal');
    const closeBtns = modal ? modal.querySelectorAll('.modal-close, .modal-cancel') : [];
    closeBtns.forEach(b => b.addEventListener('click', () => closeModal()));
    modal && modal.addEventListener('click', (e)=>{ if (e.target === modal) closeModal(); });

    const form = document.getElementById('submission-form');
    form && form.addEventListener('submit', async (ev) => {
        handleFormSubmission(ev, 'submission-modal');
    });

    const quickForm = document.getElementById('quick-inquiry-form');
    quickForm && quickForm.addEventListener('submit', async (ev) => {
        handleFormSubmission(ev, 'quick-inquiry');
    });

    // Delegate clicks for close/cancel buttons as a fallback when direct listeners may not have bound
    document.addEventListener('click', (e) => {
        if (e.target.closest('.modal-close') || e.target.closest('.modal-cancel')) {
            const modal = document.getElementById('submission-modal');
            if (modal && modal.getAttribute('aria-hidden') === 'false') closeModal();
        }
    });
}

async function handleFormSubmission(ev, source) {
    ev.preventDefault();
    const formEl = ev.currentTarget;
    const data = new FormData(formEl);

    // Client-side Validation for Phone
    const phoneInput = formEl.querySelector('input[name="phone"]');
    if (phoneInput) {
         const phoneVal = phoneInput.value.replace(/\D/g, '');
         if (phoneVal.length !== 10) {
             alert("Please enter a valid 10-digit phone number.");
             return;
         }
    }

    // Add default service if missing (for Quick Inquiry)
    if (!data.has('service')) {
        data.set('service', 'Quick Inquiry');
    }
    
    // Add default email if missing
    if (!data.has('email') || data.get('email').trim() === '') {
        data.set('email', 'Not Provided');
    }

    // File size check (only if file input exists)
    const fileInput = formEl.querySelector('input[type="file"]');
    if (fileInput && fileInput.files.length > 0) {
        let totalSize = 0;
        for (let i = 0; i < fileInput.files.length; i++) {
            totalSize += fileInput.files[i].size;
        }
        if (totalSize > 3 * 1024 * 1024) {
            alert("Total file size exceeds 3MB. Please upload smaller files.");
            return;
        }
    }

    // UI Feedback
    if (source === 'submission-modal') {
        formEl.hidden = true;
        document.getElementById('scan-screen').hidden = false;
        document.getElementById('scan-text').textContent = 'Uploading documents...';
    } else {
        const btn = formEl.querySelector('button[type="submit"]');
        if(btn) {
            btn.textContent = 'Sending...';
            btn.disabled = true;
        }
    }

    try{
        const apiUrl = getSubmitApiUrl();

        console.log('Form submission - API URL:', apiUrl);
        const res = await fetch(apiUrl, { method: 'POST', body: data });
        
        console.log('Response status:', res.status, 'Content-Type:', res.headers.get("content-type"));
        
        let result;
        try {
            result = await res.json();
            console.log('Parsed JSON response:', result);
        } catch (parseErr) {
            console.error('Failed to parse JSON response:', parseErr);
            let responseText = '';
            try {
                responseText = await res.text();
            } catch (e) {
                responseText = '(Could not read response text)';
            }
            throw new Error("Server returned invalid JSON. Response: " + responseText);
        }
        
        if (res.ok && result && result.ok) {
            if (source === 'submission-modal') {
                document.getElementById('scan-screen').hidden = true;
                document.getElementById('submit-success').hidden = false;
                // Auto close after 3s
                setTimeout(() => closeModal(), 3000);
            } else {
                alert('Inquiry sent successfully! We will contact you shortly.');
                formEl.reset();
                const btn = formEl.querySelector('button[type="submit"]');
                if(btn) {
                    btn.textContent = 'Send Inquiry';
                    btn.disabled = false;
                }
            }
        } else {
            const errorMsg = (result && result.message) || (result && result.error) || 'Submission failed';
            throw new Error(errorMsg);
        }
    } catch (err) {
        console.error('Form submission error:', err);
        let errorMessage = err.message;
        
        // Provide more helpful error messages
        if (err.message.includes('Failed to fetch')) {
            errorMessage = 'Server connection failed. Make sure the server is running on port 3010.';
        } else if (err.message.includes('invalid JSON') || err.message.includes('JSON')) {
            errorMessage = 'Server returned an invalid response. Please check server logs and try again.';
        }
        
        if (source === 'submission-modal') {
            document.getElementById('scan-screen').hidden = true;
            document.getElementById('submit-error').hidden = false;
            document.getElementById('error-msg').textContent = errorMessage;
            // Show form again so user can retry
            formEl.hidden = false;
        } else {
            alert('Error sending inquiry: ' + errorMessage);
            const btn = formEl.querySelector('button[type="submit"]');
            if(btn) {
                btn.textContent = 'Send Inquiry';
                btn.disabled = false;
            }
        }
    }
}

function getSubmitApiUrl() {
    // Static preview servers do not proxy API requests. Use the local Express
    // server there, while keeping the relative URL for Vercel and production.
    const isStaticPreview = window.location.port && window.location.port !== '3010';
    return isStaticPreview
        ? `${window.location.protocol}//${window.location.hostname}:3010/api/submit`
        : '/api/submit';
}

function closeModal(){
    const modal = document.getElementById('submission-modal');
    if (!modal) return;
    console.log('Closing submission modal');
    modal.setAttribute('aria-hidden','true');
    // reset form and state
    const form = document.getElementById('submission-form');
    if (form) { form.hidden = false; form.reset(); }
    const scan = document.getElementById('scan-screen');
    if (scan) scan.hidden = true;
    const success = document.getElementById('submit-success');
    if (success) success.hidden = true;
    const error = document.getElementById('submit-error');
    if (error) error.hidden = true;
}

// Initialize modal setup after partials load
function initSite(){
    // set dynamic year in footer
    const yEl = document.getElementById('site-year');
    if (yEl) yEl.textContent = new Date().getFullYear();

    // mark active nav link
    const links = document.querySelectorAll('.nav-list a');
    const path = window.location.pathname.split('/').pop() || 'index.html';
    links.forEach(a => {
        const href = a.getAttribute('href');
        if (href === path || (href === 'index.html' && path === '')){
            a.classList.add('active');
            a.setAttribute('aria-current','page');
        } else {
            a.classList.remove('active');
            a.removeAttribute('aria-current');
        }
    });

    // nav toggle for small screens
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('main-nav-list');
    if (toggle && nav) {
        // Clone element to remove existing listeners to prevent duplicate toggles if initSite is called twice
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        
        newToggle.addEventListener('click', () => {
            const expanded = newToggle.getAttribute('aria-expanded') === 'true';
            newToggle.setAttribute('aria-expanded', String(!expanded));
            nav.classList.toggle('open');
        });
    }

    // setup submission modal handlers
    setupSubmissionModal();
    setupInquiryForms();
    console.log('Site initialized');
}

function setupInquiryForms() {
    const forms = document.querySelectorAll('#inquiry-form, #contact-form, #quick-inquiry-form');
    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            try {
                const formData = new FormData(form);
                // Ensure service is set for inquiry forms if not present
                if (!formData.has('service')) {
                    formData.append('service', 'General Inquiry');
                }
                
                // Ensure email is set to avoid "undefined" in backend
                if (!formData.has('email') || formData.get('email').trim() === '') {
                    formData.set('email', 'Not Provided');
                }

                const apiUrl = getSubmitApiUrl();

                console.log('Inquiry submission - API URL:', apiUrl);

                const res = await fetch(apiUrl, { method: 'POST', body: formData });
                let body;
                try {
                    body = await res.json();
                } catch (parseErr) {
                    throw new Error("Server returned invalid response: " + parseErr.message);
                }

                if (res.ok && body.ok) {
                    alert('Message Sent! We will contact you shortly.');
                    form.reset();
                } else {
                    throw new Error(body.message || body.error || 'Server returned an error');
                }
            } catch (err) {
                console.error('Inquiry Submit Error:', err);
                let errorMsg = err.message;
                if (err.message.includes('Failed to fetch')) {
                    errorMsg = 'Server connection failed. Please check that the server is running on port 3010.';
                }
                alert('Failed to send message: ' + errorMsg);
            } finally {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    });
}

/* ===== Partials include loader & site init ===== */
function callNow(){
    alert("Calling Shree Vidya Tax Consultancy...\nPlease contact us directly or visit our office.");
}

async function loadPartials() {
    // When opened directly from the file system, fetch may be blocked by the browser.
    if (window.location.protocol === 'file:') {
        console.warn('Partials may not load when opening files directly (file:). Run a local HTTP server (e.g., Live Server or `python -m http.server`) to enable includes.');
    }

    const includes = document.querySelectorAll('[data-include]');
    for (const el of includes) {
        const url = el.getAttribute('data-include');
        try {
            const res = await fetch(url);
            if (res.ok) {
                const html = await res.text();
                el.innerHTML = html;
            } else {
                console.error('Include load failed:', url, res.status);
            }
        } catch (err) {
            console.error('Include fetch error:', err);
        }
    }
    initSite();
}

// run loader on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPartials);
} else {
    loadPartials();
} 
