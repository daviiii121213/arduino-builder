(function () {
  const el = document.getElementById('footer');
  if (!el) return;
  el.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="brand"><span class="mark">EP</span> Essence Pause</div>
          <p>Sua pausa para cuidar da sua essência. Cabelo, unhas, massagem, depilação e botox em Uberlândia.</p>
          <div class="social-row">
            <a href="https://www.instagram.com/essencepause.uberlandia/" target="_blank" rel="noopener" aria-label="Instagram">📷</a>
            <a href="https://wa.me/5534984036999" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
          </div>
        </div>
        <div>
          <h4>Navegação</h4>
          <ul>
            <li><a href="sobre.html">Sobre</a></li>
            <li><a href="servicos.html">Serviços</a></li>
            <li><a href="localizacao.html">Localização</a></li>
            <li><a href="contato.html">Contato</a></li>
          </ul>
        </div>
        <div>
          <h4>Contato</h4>
          <ul>
            <li><a href="https://wa.me/5534984036999" target="_blank" rel="noopener">(34) 98403-6999</a></li>
            <li><a href="https://www.instagram.com/essencepause.uberlandia/" target="_blank" rel="noopener">@essencepause.uberlandia</a></li>
            <li>Av. Rondon Pacheco, 2300 - Loja 136, Uberlândia - MG</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Essence Pause Uberlândia. Todos os direitos reservados.</span>
        <span>Horário de funcionamento sujeito a confirmação — consulte na aba Localização.</span>
      </div>
    </div>
  `;
})();
