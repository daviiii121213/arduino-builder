document.addEventListener('DOMContentLoaded', () => {

  /* Footer year */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Sticky header shadow */
  const header = document.getElementById('siteHeader');
  const progressBar = document.getElementById('progressBar');

  function onScroll(){
    if (window.scrollY > 10) header.classList.add('scrolled');
    else header.classList.remove('scrolled');

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = progress + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  function closeMenu(){
    menuToggle.classList.remove('active');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuToggle.addEventListener('click', () => {
    const isActive = menuToggle.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = isActive ? 'hidden' : '';
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  /* Smooth scroll for all anchor links (native smooth-scroll handles most,
     this ensures the mobile menu closes and offsets for sticky header) */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId.length <= 1) return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const headerHeight = header.offsetHeight;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight + 1;
      window.scrollTo({ top, behavior: 'smooth' });
      closeMenu();
    });
  });

  /* FAQ Accordion */
  const accordionItems = document.querySelectorAll('.accordion-item');
  accordionItems.forEach(item => {
    const headerBtn = item.querySelector('.accordion-header');
    const content = item.querySelector('.accordion-content');

    headerBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      accordionItems.forEach(other => {
        other.classList.remove('active');
        other.querySelector('.accordion-content').style.maxHeight = null;
      });

      if (!isActive){
        item.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });

  /* Contact form -> sends to davi.devgenius@gmail.com via the visitor's email client */
  const contactForm = document.getElementById('contactForm');
  if (contactForm){
    const formNote = document.getElementById('formNote');
    const defaultNote = formNote.textContent;

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = contactForm.name.value.trim();
      const email = contactForm.email.value.trim();
      const phone = contactForm.phone.value.trim();
      const subject = contactForm.subject.value.trim();
      const message = contactForm.message.value.trim();

      if (!name || !email || !subject || !message){
        formNote.textContent = 'Preencha nome, e-mail, assunto e mensagem antes de enviar.';
        formNote.classList.add('error');
        formNote.classList.remove('success');
        return;
      }

      const mailSubject = `[Site DevGenius] ${subject}`;
      const mailBody =
        `Nome: ${name}\n` +
        `E-mail: ${email}\n` +
        `Telefone: ${phone || 'não informado'}\n\n` +
        `Mensagem:\n${message}`;

      const mailtoLink =
        `mailto:davi.devgenius@gmail.com?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;

      window.location.href = mailtoLink;

      formNote.textContent = 'Abrindo seu aplicativo de e-mail para enviar a mensagem para davi.devgenius@gmail.com...';
      formNote.classList.add('success');
      formNote.classList.remove('error');

      setTimeout(() => {
        formNote.textContent = defaultNote;
        formNote.classList.remove('success');
      }, 6000);
    });
  }

  /* Scroll reveal animations */
  const revealTargets = document.querySelectorAll(
    '.type-card, .portfolio-card, .style-card, .price-card, .benefit-item, .step-item, .testimonial-card, .partner-card, .section-head'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealTargets.forEach(el => observer.observe(el));

});
