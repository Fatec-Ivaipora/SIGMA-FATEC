"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Logo } from "@/components/Logo";
import { FlowCarousel } from "@/components/FlowCarousel";
import { SiteHeader } from "@/components/SiteHeader";

const CONTATOS = {
  instagram: "https://www.instagram.com/fatec.ivaipora/",
  instagramLabel: "@fatec.ivaipora",
  email: "secretariageral@fatecivaipora.com.br",
  telefoneSecretaria: { label: "(43) 99848-0053", href: "tel:+5543998480053", nota: "Secretaria" },
  telefoneVestibular: { label: "(43) 99660-0220", href: "tel:+5543996600220", nota: "Vestibular" },
};

// Número do prédio (45) incluído (2026-09-19) — sem ele o Google geocodifica
// pra um ponto genérico da rua inteira em vez do prédio exato, o que deixava
// o pino do mapa mal posicionado. Mesmo endereço já usado nos certificados
// oficiais (src/lib/certificadosPdf.tsx) e no site institucional.
const ENDERECO_FATEC =
  "FATEC IVAIPORÃ, 86870-000, AVENIDA BRASIL, 45, CENTRO, Ivaiporã, Paraná";
// Google Maps Embed API oficial (2026-09-19) — antes usava o truque não
// documentado maps.google.com/maps?q=...&output=embed (sem chave, sem
// garantia de uptime, sem controle de centralização do pino). Precisa da
// Maps Embed API habilitada no projeto do Google Cloud da
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (ver .env.local).
const MAPA_EMBED_SRC = `https://www.google.com/maps/embed/v1/place?key=${
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
}&q=${encodeURIComponent(ENDERECO_FATEC)}&zoom=17`;

type EventoDestaque = {
  id: string;
  nome: string;
  descricao?: string;
  periodoSubmissao?: string;
  imagemDestaqueUrl?: string | null;
  encerrado?: boolean;
};

// Tempo de cada slide do carrossel de destaques (2026-09-24).
const INTERVALO_CARROSSEL_MS = 6000;

export default function HomePage() {
  const [eventosDestaque, setEventosDestaque] = useState<EventoDestaque[]>([]);
  const [slideAtual, setSlideAtual] = useState(0);
  const [pausado, setPausado] = useState(false);

  // Vários eventos em destaque ao mesmo tempo (2026-09-24, antes era um só —
  // RN-10). Evento encerrado fica de fora mesmo marcado como destaque:
  // "Encerrar evento" promete desligar o banner, e a home antes não olhava
  // esse campo.
  useEffect(() => {
    const q = query(collection(db, "eventos"), where("destaque", "==", true));
    return onSnapshot(q, (snap) => {
      setEventosDestaque(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as EventoDestaque)
          .filter((e) => !e.encerrado)
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      );
    });
  }, []);

  const totalSlides = eventosDestaque.length;
  // Se um evento sai do destaque enquanto a página está aberta, o índice
  // pode sobrar — volta pro primeiro em vez de mostrar slide vazio.
  const indiceVisivel = slideAtual < totalSlides ? slideAtual : 0;

  // Troca sozinho + setas pra trocar na mão (2026-09-24). Pausa com o mouse
  // em cima ou com foco de teclado dentro (ex.: Tab até o "Inscreva-se"),
  // pra ninguém perder o slide no meio da leitura/clique. O timer depende do
  // slide visível, então trocar pela seta reinicia a contagem — o slide
  // escolhido fica os 6s inteiros na tela.
  useEffect(() => {
    if (totalSlides < 2 || pausado) return;
    const timer = setTimeout(
      () => setSlideAtual((indiceVisivel + 1) % totalSlides),
      INTERVALO_CARROSSEL_MS,
    );
    return () => clearTimeout(timer);
  }, [totalSlides, pausado, indiceVisivel]);

  function irPara(delta: number) {
    setSlideAtual((indiceVisivel + delta + totalSlides) % totalSlides);
  }

  const temDestaque = totalSlides > 0;

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader mostrarEvento={temDestaque} />

      {/* Herói padrão (2026-09-19, volta condicional — some quando tem
          evento em destaque pra não duplicar/empilhar com o banner dele,
          mas sem evento nenhum a página não pode ficar vazia logo após o
          cabeçalho). */}
      {!temDestaque && (
        <section className="relative overflow-hidden bg-fatec-navy-900 px-6 pb-20 pt-16 md:px-12 md:pb-24 md:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fatec-sky-600/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-fatec-orange-500/10 blur-3xl"
          />

          <div className="relative mx-auto flex max-w-3xl flex-col items-start gap-6">
            <h1 className="text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white md:text-5xl">
              Cadastre seu trabalho acadêmico
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-fatec-navy-50/90 md:text-lg">
              Envie, acompanhe a avaliação e receba o certificado do seu
              trabalho na Fatec Ivaiporã.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-full bg-fatec-orange-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-fatec-orange-500/25 transition-transform hover:-translate-y-0.5 hover:bg-fatec-orange-600"
              >
                Entrar no sistema
                <ArrowRight
                  className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </Link>
              <a
                href="#como-funciona"
                className="text-base font-semibold text-fatec-navy-50 underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
              >
                Ver como funciona
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Mini aviso (2026-09-19, pedido do usuário) — só some pra quando um
          evento virar destaque de novo; enquanto isso, deixa claro que a
          ausência do banner é esperada, não um bug/tela quebrada. */}
      {!temDestaque && (
        <div className="border-b border-fatec-line bg-fatec-navy-50 px-6 py-4 md:px-12">
          <p className="mx-auto flex max-w-3xl items-center gap-2 text-sm text-fatec-muted">
            <CalendarOff className="h-4 w-4 flex-none" strokeWidth={1.75} />
            Nenhum evento em destaque no momento — fique de olho, novidades em breve.
          </p>
        </div>
      )}

      {/* RF-29 / RN-11: evento em destaque, marcado manualmente pela organização.
          Some inteiramente da tela quando nenhum evento está marcado como destaque.
          Foto + faixa de texto separadas (2026-09-19 — a versão anterior
          sobrepunha o texto direto na foto com um degradê, mas a imagem do
          evento já costuma vir com texto próprio desenhado nela, causando
          escrita em cima de escrita. Agora a foto é só foto, e o texto
          (badge, título, período, CTA) mora numa faixa navy sólida colada
          embaixo — sem sobrepor nada, sempre legível não importa o que tem
          na imagem.
          Proporção 12:5, igual ao recorte no cadastro do evento
          (BannerCropModal) — 2026-09-29, corrigido depois de um banner
          saindo cortado na home: antes a caixa tinha altura fixa em pixel
          + largura 100% fluida, então em tela larga a proporção real
          ficava bem mais larga que o recorte prometia, e o navegador
          cortava em cima/embaixo do que já tinha sido recortado. Agora
          `aspect-[12/5]` mantém a proporção sempre igual à do recorte
          (nunca corta de surpresa, em nenhum tamanho de tela) e
          `max-w-[1008px]` (= altura máxima antiga de 420px × 12/5) evita
          virar gigante em monitor muito largo — a partir daí a foto para
          de esticar e fica centralizada, com o navy de fundo sobrando nas
          laterais em vez de esticar/cortar a imagem.
          Carrossel (2026-09-24): com mais de um evento em destaque, os slides
          ficam empilhados na mesma célula de grid e trocam por opacidade —
          a altura é sempre a do slide mais alto, então a página não "pula"
          quando a descrição de um evento é maior que a do outro. */}
      {temDestaque && (
        <section
          id="evento-destaque"
          aria-roledescription={totalSlides > 1 ? "carrossel" : undefined}
          aria-label="Eventos em destaque"
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
          // Só foco de teclado pausa — clicar na seta com o mouse também dá
          // foco nela, e aí o carrossel ficaria parado pra sempre depois que
          // o mouse saísse (o blur só vem quando clica em outro lugar).
          onFocus={(e) => {
            if (e.target.matches(":focus-visible")) setPausado(true);
          }}
          onBlur={() => setPausado(false)}
          className="relative scroll-mt-20 bg-fatec-navy-900"
        >
          <div className="grid">
            {eventosDestaque.map((evento, i) => {
              const ativo = i === indiceVisivel;
              return (
                <div
                  key={evento.id}
                  aria-hidden={!ativo}
                  inert={!ativo}
                  aria-roledescription={totalSlides > 1 ? "slide" : undefined}
                  aria-label={totalSlides > 1 ? `${i + 1} de ${totalSlides}` : undefined}
                  className={`[grid-area:1/1] transition-opacity duration-700 motion-reduce:transition-none ${
                    ativo ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  {/* Entrada do slide (2026-09-24): a foto chega com um zoom
                      lento de 108% → 100% enquanto aparece, e o texto sobe
                      um pouco com atraso — dá sensação de movimento sem
                      deslizar a página inteira pro lado. */}
                  <div className="mx-auto aspect-[12/5] w-full max-w-[1008px] overflow-hidden">
                    <div
                      className={`h-full w-full transition-transform duration-[1600ms] ease-out motion-reduce:transition-none ${
                        ativo ? "scale-100" : "scale-[1.08]"
                      }`}
                    >
                      {evento.imagemDestaqueUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={evento.imagemDestaqueUrl}
                          alt={evento.nome}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="relative h-full w-full bg-gradient-to-br from-fatec-navy-700 via-fatec-navy-900 to-fatec-sky-700"
                        >
                          <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                          <div className="absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-fatec-orange-500/20 blur-3xl" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`px-6 py-6 transition-all duration-700 ease-out motion-reduce:transition-none md:px-12 md:py-8 ${
                      ativo ? "translate-y-0 opacity-100 delay-200" : "translate-y-3 opacity-0"
                    }`}
                  >
                    <div className="mx-auto max-w-5xl">
                      <span className="inline-flex items-center rounded-full bg-fatec-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-[-0.01em] text-white">
                        Em destaque
                      </span>
                      <h3 className="mt-3 text-2xl font-extrabold leading-tight tracking-[-0.02em] text-white md:text-4xl">
                        {evento.nome}
                      </h3>
                      {evento.periodoSubmissao && (
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-white/85 md:text-base">
                          <CalendarDays className="h-4 w-4 flex-none" strokeWidth={2} />
                          Inscrições: {evento.periodoSubmissao}
                        </p>
                      )}
                      {/* Descrição (2026-09-19, pedido da organização — agrupada na
                          mesma faixa navy do resto, não numa seção branca separada
                          embaixo, pra não virar 2 faixas de cor diferente. */}
                      {evento.descricao && (
                        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/80 md:text-base">
                          {evento.descricao}
                        </p>
                      )}
                      <Link
                        href="/login"
                        className="group/btn mt-5 inline-flex items-center gap-2 rounded-full bg-fatec-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/25 transition-transform hover:-translate-y-0.5 hover:bg-fatec-orange-600"
                      >
                        Inscreva-se
                        <ArrowRight
                          className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5"
                          strokeWidth={2}
                        />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Setas (2026-09-24, pedido do usuário) — em cima da foto,
              centralizadas na altura dela (mesmas alturas fixas da foto). */}
          {totalSlides > 1 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[300px] items-center justify-between px-3 sm:h-[360px] md:h-[420px] md:px-6">
              <button
                type="button"
                onClick={() => irPara(-1)}
                aria-label="Evento anterior"
                className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl bg-fatec-navy-950/55 text-white transition-colors hover:bg-fatec-navy-950/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => irPara(1)}
                aria-label="Próximo evento"
                className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl bg-fatec-navy-950/55 text-white transition-colors hover:bg-fatec-navy-950/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronRight className="h-6 w-6" strokeWidth={2} />
              </button>
            </div>
          )}

          {/* Bolinhas: só indicador de quantos slides tem e qual está na
              tela, sem clique — a navegação manual é pelas setas. */}
          {totalSlides > 1 && (
            <div aria-hidden className="flex justify-center gap-2 pb-6">
              {eventosDestaque.map((evento, i) => (
                <span
                  key={evento.id}
                  className={`h-2 rounded-full transition-all duration-500 motion-reduce:transition-none ${
                    i === indiceVisivel ? "w-6 bg-fatec-orange-500" : "w-2 bg-white/35"
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section
        id="como-funciona"
        className="flex-1 bg-fatec-navy-50 px-6 py-20 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
              Como funciona
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-fatec-navy-900 md:text-4xl">
              Da inscrição à certificação, em quatro etapas.
            </h2>
          </div>

          <FlowCarousel />
        </div>
      </section>

      <section className="bg-white px-6 py-16 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-0 md:divide-x md:divide-fatec-line">
          <div className="flex flex-col gap-3 md:pr-10">
            <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
              Local
            </span>
            <h2 className="text-2xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Fatec Ivaiporã
            </h2>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-fatec-muted">
              <MapPin className="mt-0.5 h-4 w-4 flex-none text-fatec-navy-800" strokeWidth={1.75} />
              {ENDERECO_FATEC}
            </p>
          </div>

          <div className="md:pl-10">
            <iframe
              title="Mapa até a Fatec Ivaiporã"
              src={MAPA_EMBED_SRC}
              loading="lazy"
              className="h-80 w-full rounded-2xl border border-fatec-line md:h-[420px]"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-fatec-line bg-fatec-navy-900 px-6 py-14 md:px-12 md:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <Logo className="h-10 w-auto" />
              <p className="max-w-xs text-sm leading-relaxed text-fatec-navy-50/70">
                Faculdade de Tecnologia do Vale do Ivaí — cursos superiores de
                tecnologia gratuitos e presenciais em Ivaiporã.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[-0.01em] text-fatec-navy-50/50">
                Contato
              </h3>
              <a
                href={`mailto:${CONTATOS.email}`}
                className="flex items-center gap-2 text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 flex-none" strokeWidth={1.75} />
                {CONTATOS.email}
              </a>
              <a
                href={CONTATOS.telefoneSecretaria.href}
                className="flex items-center gap-2 text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4 flex-none" strokeWidth={1.75} />
                {CONTATOS.telefoneSecretaria.label}
                <span className="text-fatec-navy-50/50">
                  · {CONTATOS.telefoneSecretaria.nota}
                </span>
              </a>
              <a
                href={CONTATOS.telefoneVestibular.href}
                className="flex items-center gap-2 text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4 flex-none" strokeWidth={1.75} />
                {CONTATOS.telefoneVestibular.label}
                <span className="text-fatec-navy-50/50">
                  · {CONTATOS.telefoneVestibular.nota}
                </span>
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[-0.01em] text-fatec-navy-50/50">
                Acompanhe
              </h3>
              <a
                href={CONTATOS.instagram}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                <InstagramIcon className="h-4 w-4 flex-none" />
                {CONTATOS.instagramLabel}
              </a>
              <a
                href="https://fatecivaipora.com.br/"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-fatec-navy-50/80 transition-colors hover:text-white"
              >
                fatecivaipora.com.br
              </a>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/10 pt-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/desenvolvido-por-fatec.jpg"
              alt="Desenvolvido por Fatec Ivaiporã"
              className="h-12 w-fit rounded-lg bg-white px-4 py-2.5"
            />
            <p className="text-xs text-fatec-navy-50/50">
              © {new Date().getFullYear()} SIGMA Fatec · Fatec Ivaiporã
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
