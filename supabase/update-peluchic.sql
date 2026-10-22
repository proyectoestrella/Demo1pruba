-- GENERADO por scripts/generar-sql-peluchic.ts desde src/lib/demos/peluchic.ts.
-- NO editar a mano: cambia la demo y vuelve a generar (bun scripts/generar-sql-peluchic.ts).
--
-- Actualiza el perfil de un PeluChic que YA existe.
-- ATENCIÓN: PISA la configuración actual (carta, equipo, horarios, preguntas,
-- precios literales, días especiales, textos…) con la de la puesta en marcha.
-- Es para usarlo ANTES de que María toque nada: cualquier cambio que ella haya
-- hecho en esos campos desde el panel se pierde. Las claves que no están aquí
-- (plantillas de WhatsApp, colores, bloqueos…) se conservan.
-- Antes de escribir guarda el perfil anterior en perfil_versiones (nota
-- 'antes de update-peluchic.sql'); con rollback-update-peluchic.sql se recupera.
-- Idempotente: si el perfil ya es este, no escribe ni guarda otra copia.
-- No toca clientas, citas, pagos ni miembros. Una transacción: si sale un
-- error, ejecuta `rollback;` y vuelve a pulsar Run.
begin;
do $actualizar$
declare
  nuevo jsonb := $perfil$
{
  "id":"peluchic",
  "slug":"peluchic",
  "name":"PeluChic",
  "tagline":"Peluquería y maquillaje",
  "about":"Peluquería y maquillaje profesional en Sanchinarro, en el salón o a domicilio. Años de experiencia en teatro, televisión y publicidad: peinados y maquillaje de cámara y foco, novias, ceremonias y eventos.",
  "address":"C/ Princesa de Éboli 100, local 104, entrada por el patio de c/ María Tudor 14, 28050 Madrid (Sanchinarro)",
  "phone":"666 77 67 31",
  "whatsapp":"+34 666 77 67 31",
  "instagram":"@peluchicprofesional",
  "enlaces":{"blog":"https://peluchic.online/","instagram":"https://www.instagram.com/peluchicprofesional","facebook":"https://www.facebook.com/peluchicprofesional/","tienda":"https://peluchic.online/tienda/ols/all","resenas":"https://www.google.com/maps/search/?api=1&query=PeluChic&query_place_id=ChIJc_dY3q0uQg0ReeAzc1Y3irs"},
  "destacados":["lavado-corte-peinar","color-organico","mechas","novias"],
  "boletin":{"texto":"Suscríbete a nuestro boletín y recibe noticias sobre promociones, ofertas y eventos.","url":"https://peluchic.online/"},
  "openingHours":["Cerrado","10:00–20:00","10:00–20:00","10:00–20:00","10:00–20:00","9:00–14:00","Cerrado"],
  "timeZone":"Europe/Madrid",
  "correoPrivacidad":"mariapeluchic@gmail.com",
  "heroImage":"/demo/peluchic-galeria/portada-1600.webp",
  "galeriaPropia":[{"url":"/demo/peluchic-galeria/recogido-ondas-trenzado-1200.webp","alt":"Recogido de ondas trenzadas en melena castaña, visto de espaldas"},{"url":"/demo/peluchic-galeria/semirrecogido-trenzas-en-proceso-1200.webp","alt":"Manos de la estilista terminando un semirrecogido con trenzas en cabello cobrizo"},{"url":"/demo/peluchic-galeria/recogido-trenzado-rubia-1200.webp","alt":"Recogido bajo trenzado en cabello rubio con mechas, visto de espaldas"},{"url":"/demo/peluchic-galeria/comunion-corona-flores-1200.webp","alt":"Peinado de comunión con ondas y corona de flores, visto de espaldas"},{"url":"/demo/peluchic-galeria/invitada-recogido-salon-1200.webp","alt":"Recogido con trenza y moño de invitada de boda, en el salón"},{"url":"/demo/peluchic-galeria/recogido-pelirroja-encaje-1200.webp","alt":"Recogido alto en cabello pelirrojo con blusa de encaje"},{"url":"/demo/peluchic-galeria/recogido-bajo-morena-1200.webp","alt":"Recogido bajo con ondas en cabello moreno, visto de espaldas"},{"url":"/demo/peluchic-galeria/semirrecogido-pelirroja-1200.webp","alt":"Semirrecogido con ondas en cabello pelirrojo, visto de espaldas"},{"url":"/demo/peluchic-galeria/recogido-lateral-rubia-1200.webp","alt":"Recogido lateral en cabello rubio, de frente"},{"url":"/demo/peluchic-galeria/novia-melena-suelta-1200.webp","alt":"Novia con melena suelta ondulada en un campo de lavanda"},{"url":"/demo/peluchic-galeria/comunion-ondas-flores-1200.webp","alt":"Peinado de comunión con ondas y flores blancas, de perfil"},{"url":"/demo/peluchic-galeria/recogido-bajo-rubia-1200.webp","alt":"Moño bajo pulido en cabello rubio, visto de espaldas"}],
  "logoUrl":"/demo/peluchic-logo.png",
  "logotipoClaroUrl":"/demo/peluchic-logotipo-blanco.webp",
  "logotipoOscuroUrl":"/demo/peluchic-logotipo-oscuro.webp",
  "specialties":["novias y eventos","maquillaje de cámara","color orgánico","tratamientos capilares"],
  "team":["María~Gerente · peluquería, color y novias","Anca~Faciales y spa japonés","Patricia~Estética, masajes y cabina"],
  "teamExperience":[0,0,0],
  "teamIds":["maria","anca","patricia"],
  "teamHours":[["Cerrado","14:00–20:00","10:00–20:00","10:00–20:00","10:00–20:00","Cerrado","Cerrado"],["Cerrado","10:00–20:00","Cerrado","14:00–20:00","10:00–20:00","9:00–14:00","Cerrado"],["Cerrado","10:00–20:00","10:00–20:00","10:00–20:00","10:00–20:00","9:00–13:00","Cerrado"]],
  "serviciosPorProfesional":{"maria":["lavado","lavado-corte-secar","lavado-corte-peinar","peinar","cortar-caballero-nino","cortar-anadido","color-organico","color-10-minutos","bano-brillo","barros","mechas","mechas-matiz","money-piece","matiz","ahuecador","ozonoterapia","diagnostico-camara","dermapen","hidrobalance","barros-cuero-cabelludo","hidratacion-intensiva","proteinas","tipo-bx","olaplex","olaplex-quelante","reconstructor-rizos","nanokeratinizacion","hyaluroplastia","combonano","barros-tratantes","keratina","keratina-plus","spa-japones-cabeza","spa-japones-cabeza-facial","laminado-cejas","laminado-tinte-cejas","tinte-cejas","depilacion-ceja","lifting-coreano","lifting-tinte","lifting-tinte-laminado","lifting-tinte-laminado-tinte","ojos-bolsas-ojeras","higiene-facial-hidroface","ritual-rosegold","ritual-panacee","ritual-hidroface","radiofrecuencia-facial","masajes","model-shape","radiofrecuencia-corporal","maquillaje-correccion","peluqueria-focos","novias"],"anca":["lavado","lavado-corte-secar","lavado-corte-peinar","peinar","cortar-caballero-nino","cortar-anadido","color-organico","color-10-minutos","bano-brillo","barros","mechas","mechas-matiz","money-piece","matiz","ahuecador","ozonoterapia","diagnostico-camara","dermapen","hidrobalance","barros-cuero-cabelludo","hidratacion-intensiva","proteinas","tipo-bx","olaplex","olaplex-quelante","reconstructor-rizos","nanokeratinizacion","hyaluroplastia","combonano","barros-tratantes","keratina","keratina-plus","spa-japones-cabeza","spa-japones-cabeza-facial","maquillaje-correccion","peluqueria-focos","novias","laminado-cejas","laminado-tinte-cejas","tinte-cejas","depilacion-ceja","lifting-coreano","lifting-tinte","lifting-tinte-laminado","lifting-tinte-laminado-tinte","ojos-bolsas-ojeras","higiene-facial-hidroface","ritual-rosegold","ritual-panacee","ritual-hidroface","radiofrecuencia-facial"],"patricia":["lavado","lavado-corte-secar","lavado-corte-peinar","peinar","cortar-caballero-nino","cortar-anadido","color-organico","color-10-minutos","bano-brillo","barros","mechas","mechas-matiz","money-piece","matiz","ahuecador","ozonoterapia","diagnostico-camara","dermapen","hidrobalance","barros-cuero-cabelludo","hidratacion-intensiva","proteinas","tipo-bx","olaplex","olaplex-quelante","reconstructor-rizos","nanokeratinizacion","hyaluroplastia","combonano","barros-tratantes","keratina","keratina-plus","spa-japones-cabeza","spa-japones-cabeza-facial","maquillaje-correccion","peluqueria-focos","novias","laminado-cejas","laminado-tinte-cejas","tinte-cejas","depilacion-ceja","lifting-coreano","lifting-tinte","lifting-tinte-laminado","lifting-tinte-laminado-tinte","ojos-bolsas-ojeras","higiene-facial-hidroface","ritual-rosegold","ritual-panacee","ritual-hidroface","exosomas","dermapen-facial","radiofrecuencia-facial","masajes","model-shape","radiofrecuencia-corporal","dermapen-corporal"]},
  "bloqueosAgenda":[{"id":"comida-viernes-maria","profesionalId":"maria","inicio":"2026-10-16T12:00:00.000Z","fin":"2026-10-16T13:00:00.000Z","recurrente":{"diaSemana":5},"motivo":"Comida · hora de ejemplo hasta que María confirme"},{"id":"comida-viernes-anca","profesionalId":"anca","inicio":"2026-10-16T12:00:00.000Z","fin":"2026-10-16T13:00:00.000Z","recurrente":{"diaSemana":5},"motivo":"Comida · hora de ejemplo hasta que María confirme"},{"id":"comida-viernes-patricia","profesionalId":"patricia","inicio":"2026-10-16T12:00:00.000Z","fin":"2026-10-16T13:00:00.000Z","recurrente":{"diaSemana":5},"motivo":"Comida · hora de ejemplo hasta que María confirme"}],
  "diasEspeciales":[{"fecha":"2026-10-12","cerrado":true},{"fecha":"2026-11-02","cerrado":true},{"fecha":"2026-11-09","cerrado":true},{"fecha":"2026-12-07","cerrado":true},{"fecha":"2026-12-08","cerrado":true},{"fecha":"2026-12-25","cerrado":true},{"fecha":"2027-01-01","cerrado":true},{"fecha":"2026-12-24","franjas":[{"inicio":"10:00","fin":"15:00"}]},{"fecha":"2026-12-31","franjas":[{"inicio":"10:00","fin":"15:00"}]},{"fecha":"2026-12-21","soloProfesionales":{"maria":[{"inicio":"10:00","fin":"20:00"}]}},{"fecha":"2026-12-23","soloProfesionales":{"anca":[{"inicio":"15:00","fin":"20:00"}]}}],
  "menu":[
    "Lavado personalizado~15~10~Trabajos Cotidianos Peluquería~~lavado",
    "Lavado personalizado + Corte +Secar humedad~45~28.5~Trabajos Cotidianos Peluquería~~lavado-corte-secar",
    "Lavado personalizado + Corte + Peinar~60~43.5~Trabajos Cotidianos Peluquería~~lavado-corte-peinar",
    "Peinar~40~24~Trabajos Cotidianos Peluquería~~peinar",
    "Cortar Caballero/Niño~30~19.5~Trabajos Cotidianos Peluquería~~cortar-caballero-nino",
    "Cortar Añadido a otro servicio~30~19.5~Trabajos Cotidianos Peluquería~~cortar-anadido",
    "Color de cobertura Organico~60~41.5~Trabajos Cotidianos Peluquería~~color-organico",
    "Color de cobertura en 10 minutos~50~41.5~Trabajos Cotidianos Peluquería~~color-10-minutos",
    "Baño de brillo~50~41.5~Trabajos Cotidianos Peluquería~~bano-brillo",
    "Barros tintóreos~60~65.5~Trabajos Cotidianos Peluquería~~barros",
    "Mechas*~120~46.5~Trabajos Cotidianos Peluquería~~mechas",
    "Mechas + Matiz~180~116.5~Trabajos Cotidianos Peluquería~~mechas-matiz",
    "Money piece~30~18.5~Trabajos Cotidianos Peluquería~~money-piece",
    "Matiz~40~30~Trabajos Cotidianos Peluquería~~matiz",
    "Ahuecador -Moldeados~90~45~Trabajos Cotidianos Peluquería~~ahuecador",
    "OZONOTHERAPIA~60~41~Tratamientos Cuero Cabelludo~~ozonoterapia",
    "Diagnostico capilar con cámara~20~10.5~Tratamientos Cuero Cabelludo~~diagnostico-camara",
    "Dermapen capilar sesion 30´~60~55~Tratamientos Cuero Cabelludo~~dermapen",
    "Hidrobalance capilar~60~55~Tratamientos Cuero Cabelludo~~hidrobalance",
    "barros cuero cabelludo~60~65.5~Tratamientos Cuero Cabelludo~~barros-cuero-cabelludo",
    "tratamiento de hidratacion intensiva~60~22.5~Tratamientos Cabello~~hidratacion-intensiva",
    "tratamiento de proteinas~60~36~Tratamientos Cabello~~proteinas",
    "tratamiento tipo bx~150~57~Tratamientos Cabello~~tipo-bx",
    "tratamiento olaplex~60~47~Tratamientos Cabello~~olaplex",
    "tratamiento olaplex Quelante~60~20~Tratamientos Cabello~~olaplex-quelante",
    "tratamiento reconstructor de rizos~60~26~Tratamientos Cabello~~reconstructor-rizos",
    "Nanokeratinizacion~60~42~Tratamientos Cabello~~nanokeratinizacion",
    "Hyaluroplastia~60~22~Tratamientos Cabello~~hyaluroplastia",
    "Combonano 4 sesiones en un mes~60~88~Tratamientos Cabello~~combonano",
    "barros Tratantes~60~75~Tratamientos Cabello~~barros-tratantes",
    "tratamiento keratina~120~101~Tratamientos Cabello~~keratina",
    "Tratamiento keratina PLUS~180~250~Tratamientos Cabello~~keratina-plus",
    "Spa japonés solo cabeza~60~71~Tratamientos Cabello~~spa-japones-cabeza",
    "Spa japonés cabeza y facial~120~135~Tratamientos Cabello~~spa-japones-cabeza-facial",
    "Laminado cejas~60~28~Trabajos de la Mirada~~laminado-cejas",
    "Laminado cejas y tinte cejas~90~36~Trabajos de la Mirada~~laminado-tinte-cejas",
    "tinte de cejas~30~9~Trabajos de la Mirada~~tinte-cejas",
    "depilacion de ceja~30~12~Trabajos de la Mirada~~depilacion-ceja",
    "Linfting KOREANO pestañas~60~36~Trabajos de la Mirada~~lifting-coreano",
    "Linfting pestañas +tinte de pestañas~90~46.5~Trabajos de la Mirada~~lifting-tinte",
    "Linfting pestañas +tinte de pestañas +laminado de cejas~90~57~Trabajos de la Mirada~~lifting-tinte-laminado",
    "Linfting pestañas +tinte de pestañas +laminado de cejas+tinte de cejas~90~65~Trabajos de la Mirada~~lifting-tinte-laminado-tinte",
    "tratamiento ojos- bolsas y ojeras~60~65~Trabajos de la Mirada~~ojos-bolsas-ojeras",
    "Higiene facial hidroface~60~0~Trabajos Faciales~~higiene-facial-hidroface",
    "Ritualfacial hidroface RoseGold~75~65~Trabajos Faciales~~ritual-rosegold",
    "Ritualfacial hidroface panacee~75~65~Trabajos Faciales~~ritual-panacee",
    "Ritual hidroface~90~65~Trabajos Faciales~~ritual-hidroface",
    "Tratamiento de exosomas~60~65~Trabajos Faciales~~exosomas",
    "Dermapen facial~60~65~Trabajos Faciales~~dermapen-facial",
    "tratamiento facial Radiofrecuencia-diatermia~30~35~Trabajos Faciales~~radiofrecuencia-facial",
    "Masaje corporal~60~50~Trabajos Corporales~~masajes",
    "Masaje model shape~60~50~Trabajos Corporales~~model-shape",
    "tratamiento corporal Radiofrecuencia-diatermia~60~35~Trabajos Corporales~~radiofrecuencia-corporal",
    "Dermapen corporal~60~65~Trabajos Corporales~~dermapen-corporal",
    "Maquillaje de Correccion~45~65~Trabajos de Cámara y Foco~~maquillaje-correccion",
    "Peluqueria focos~45~65~Trabajos de Cámara y Foco~~peluqueria-focos",
    "Novias~90~150~Trabajos de Cámara y Foco~~novias"
  ],
  "descripcionesServicios":{"lavado":"Según tu necesidad capilar y con productos profesionales: champús sin derivados del petróleo y mascarillas nutritivas o hidratantes.","lavado-corte-secar":"Corte completo con lavado con los productos que tu cabello necesita y secado de la humedad con secador.","lavado-corte-peinar":"Corte completo con lavado y peinado: 43,50 € corto o medio y 47,50 € largo o con cantidad. Plus plancha, 3 €.","peinar":"Lavado personalizado, protector térmico y fijador, trabajado con secador: 24 € cortos o medias melenas, 28 € largo o mucha cantidad y 31 € con plancha.","cortar-caballero-nino":"Hombre o niño, mismo precio: el tiempo y los años de experiencia son los mismos para todos.","cortar-anadido":"Corte combinado con otro servicio, por ejemplo color, tratamientos o mechas.","color-organico":"Coloración permanente con cobertura total de canas y notas de magnolia y bergamota. Incluye lavado y secado de humedad. Dura unas 5 semanas.","color-10-minutos":"Tu color y cobertura de canas en 10 minutos, enriquecido con keratina. Incluye lavado y secado de humedad.","bano-brillo":"Refresco de pigmentos para un extra de brillo: disimula la cana sin cubrirla. Sin amoniaco y vegano. Dura de 0 a 4 semanas.","barros":"Coloración con plantas medicinales tintóreas, algas y flores: color y brillo sin dañar la fibra, y regula el pH del cuero cabelludo.","mechas":"Parciales, micro, balayage, californianas, clásicas o reflejos: personalizamos las mechas que necesites. El precio va según el producto utilizado.","mechas-matiz":"Mechas personalizadas con matiz incluido.","money-piece":"Solo en la parte frontal, con o sin matiz, para iluminar tu rostro. Precio añadido a otro servicio (color, peinar o barro).","matiz":"Para corregir tonos no deseados: amarillos, naranjas o incluso verdes. No incluye lavado ni secado de humedad.","ahuecador":"Técnica clásica con productos actuales para dar forma o volumen: desde un leve volumen a una onda más marcada.","ozonoterapia":"Tricología para regular el pH, los picores, la grasa y la caspa, y reforzar el bulbo piloso. Básica 41 €, con tónicos 49 € y completa 51,50 €.","diagnostico-camara":"Valoración del estado del cuero cabelludo y del bulbo piloso con cámara.","dermapen":"Micropunción con principios activos para reforzar el cabello desde el cuero cabelludo. Incluye lavado personalizado.","hidrobalance":"Peeling y aparatología en tres pasos —limpiar, tonificar e implantar— para que el tratamiento penetre en el cuero cabelludo.","barros-cuero-cabelludo":"Algas, flores y plantas medicinales para limpiar y mineralizar el cuero cabelludo: calma desde la primera aplicación.","hidratacion-intensiva":"Hidrata hasta cuatro veces más que una mascarilla; puedes hacerlo durante el tiempo del color. Precio según el producto absorbido.","proteinas":"Para cabello dañado o frágil: brillo, grosor y, en rizos, definición. Precio según el producto absorbido.","tipo-bx":"Fórmula multiproteica que nutre y rellena la fibra: rejuvenecimiento visible desde la primera aplicación. Dura de 1 a 3 meses.","olaplex":"Reparación desde el interior para cabellos dañados o sensibilizados, con química o sin ella.","olaplex-quelante":"Purificación profunda: elimina residuos de aceite, agua dura y metales antes de una keratina, un color o una permanente.","reconstructor-rizos":"Refuerza los rizos: más definición, brillo, movimiento e hidratación y menos encrespamiento desde la primera sesión.","nanokeratinizacion":"Vapor frío con keratina y ácido hialurónico para cabellos extradañados. No incluye el peinado, que es necesario (28 €): 70 € en total.","hyaluroplastia":"Vapor frío con ácido hialurónico para cabellos secos y opacos. No incluye el peinado, que es necesario (28 €): 50 € en total.","combonano":"Bono de 4 sesiones, una por semana: nanokeratinización, hyaluroplastia y ozonoterapia. No incluye los peinados, que son necesarios.","barros-tratantes":"Tratamiento natural y orgánico de filosofía japonesa que mineraliza, hidrata y da fuerza y grosor al cabello.","keratina":"Elimina el frizz y relaja la onda de 3 a 6 meses, con brillo extremo. También en versión vegana. Precio según el producto.","keratina-plus":"Tratamiento de keratina PLUS.","spa-japones-cabeza":"Masaje craneal shiatsu, chorros de agua en puntos de acupuntura y cama de magneto: descarga cabeza, cuello y hombros.","spa-japones-cabeza-facial":"Masaje craneal shiatsu, chorros de agua en puntos de acupuntura y cama de magneto, con ritual facial.","laminado-cejas":"Incluye recorte y diseño con depilación.","laminado-tinte-cejas":"Incluye recorte y diseño con depilación.","tinte-cejas":"Sin diseño ni depilación.","depilacion-ceja":"Con diseño.","lifting-coreano":"En cabina.","lifting-tinte":"En cabina.","lifting-tinte-laminado":"En cabina.","lifting-tinte-laminado-tinte":"En cabina.","ojos-bolsas-ojeras":"Principios activos para el contorno de ojos: minimiza bolsas, ojeras y flacidez desde la primera aplicación.","higiene-facial-hidroface":"Higiene con el equipo hidroface de 7 cabezales (galvánica, radiofrecuencia, infrarrojo…): no invasiva, indolora y con resultados inmediatos.","ritual-rosegold":"Tratamiento de 5 sesiones recomendado (325 € en total), con productos de laboratorio de alto contenido en activos.","ritual-panacee":"Tratamiento de 4 sesiones recomendado (260 € en total), con productos de laboratorio de alto contenido en activos.","ritual-hidroface":"Ritual facial hidroface de 90 minutos.","exosomas":"Tratamiento facial de exosomas.","dermapen-facial":"Tratamiento facial Dermapen.","radiofrecuencia-facial":"Radiofrecuencia diatermia a 448 kHz. Pregunta en cabina toda la información.","masajes":"Relajantes, drenantes, anticelulíticos, reafirmantes o reductores de 50 min; craneales de 30 min.","model-shape":"Tratamiento manual de reducción corporal: pérdida rápida de centímetros y piel más tersa desde la primera sesión.","radiofrecuencia-corporal":"Calienta el tejido poco a poco para producir colágeno nuevo: indoloro y no invasivo. Bonos de 5 sesiones desde 160 €.","dermapen-corporal":"Tratamiento corporal Dermapen.","maquillaje-correccion":"Maquillaje para cámara y foco: cine, TV, teatro y publicidad. También maquillaje para novias.","peluqueria-focos":"Peluquería de plató, preparada para cine, TV, teatro y publicidad.","novias":"Consultar información: escríbenos por WhatsApp y te contamos."},
  "preciosLiterales":{"lavado-corte-peinar":"43,50 € / 47,50 €","peinar":"24 € / 28 € / 31 €","barros":"65,50 € / 72 € / 77 €","mechas":"46,50 € / 106,50 €","money-piece":"18,50 € / 23,50 €","ozonoterapia":"41 € / 49 € / 51,50 €","hidratacion-intensiva":"22,50 € / 28,50 €","proteinas":"36 € / 46,50 €","tipo-bx":"57 € / 89,50 €","olaplex":"47 € / 67,50 €","olaplex-quelante":"20 € / 28 €","reconstructor-rizos":"26 € / 31 €","keratina":"101 € / 200 € / 250 €","higiene-facial-hidroface":"A definir, con diagnóstico","radiofrecuencia-facial":"35 € / 65 €","masajes":"50 € · bono 5: 225 € · bono 10: 400 €","model-shape":"50 € · bono 5: 225 € · bono 10: 400 €","radiofrecuencia-corporal":"30 min 35 € / 60 min 65 €","maquillaje-correccion":"65 € (sin IVA)","peluqueria-focos":"desde 65 € / 150 € (sin IVA)","novias":"desde 150 € (sin IVA)"},
  "faq":["¿Cómo pido cita?~Solo atendemos con cita previa. Puedes reservar aquí mismo o escribirnos por WhatsApp al 666 77 67 31.","¿Hay que dejar fianza?~Sí. Es de 5 € por cada hora de servicio (se calcula según la duración). Al confirmar tu solicitud tendrás 4 horas para pagarla por Bizum y la dueña marcará el pago al recibirlo.","¿Y si encuentro la puerta cerrada?~Será que estamos atendiendo a domicilio o en otro trabajo de exterior. Escríbenos por WhatsApp y te contestamos.","¿Venís a domicilio?~Sí, con desplazamiento nacional e internacional desde nuestro estudio de Madrid. El coste del desplazamiento va por kilometraje: pregúntanos por WhatsApp.","¿Hacéis novias y eventos?~Sí: peluquería y maquillaje de novia, ceremonias y eventos, desde 150 € (sin IVA). Escríbenos y te contamos.","¿Trabajáis para cine, TV o publicidad?~Sí: peluquería y maquillaje de cámara y foco para producciones, también por horas (150 €/h sin IVA). Consúltanos.","¿Tenéis tratamientos corporales?~Sí, en cabina: masajes, model shape, radiofrecuencia y «Activación» (drenaje, reductor, reafirmante, anticelulítico y presoterapia). Pregúntanos el precio."],
  "preguntasReserva":[{"id":"hairLength","texto":"¿Qué cantidad de pelo tienes?","tipo":"opcion","opciones":["Poco","Medio","Mucho","Excesivo"],"obligatoria":false,"activa":true,"servicios":["lavado","lavado-corte-secar","lavado-corte-peinar","peinar","cortar-caballero-nino","cortar-anadido","color-organico","color-10-minutos","bano-brillo","barros","mechas","mechas-matiz","money-piece","matiz","ahuecador","ozonoterapia","diagnostico-camara","dermapen","hidrobalance","barros-cuero-cabelludo","hidratacion-intensiva","proteinas","tipo-bx","olaplex","olaplex-quelante","reconstructor-rizos","nanokeratinizacion","hyaluroplastia","combonano","barros-tratantes","keratina","keratina-plus","spa-japones-cabeza","spa-japones-cabeza-facial","maquillaje-correccion","peluqueria-focos","novias"]},{"id":"hasColor","texto":"¿Llevas color, tintes o mechas ahora?","tipo":"opcion","opciones":["Sí","No"],"permiteOtro":true,"obligatoria":false,"activa":true,"servicios":["lavado","lavado-corte-secar","lavado-corte-peinar","peinar","cortar-caballero-nino","cortar-anadido","color-organico","color-10-minutos","bano-brillo","barros","mechas","mechas-matiz","money-piece","matiz","ahuecador","ozonoterapia","diagnostico-camara","dermapen","hidrobalance","barros-cuero-cabelludo","hidratacion-intensiva","proteinas","tipo-bx","olaplex","olaplex-quelante","reconstructor-rizos","nanokeratinizacion","hyaluroplastia","combonano","barros-tratantes","keratina","keratina-plus","spa-japones-cabeza","spa-japones-cabeza-facial","maquillaje-correccion","peluqueria-focos","novias"]},{"id":"recentChemical","texto":"¿Te has hecho algún tratamiento químico en el último mes (tinte, mechas, alisado, permanente)?","tipo":"opcion","opciones":["Sí","No"],"permiteOtro":true,"obligatoria":false,"activa":true,"servicios":["lavado","lavado-corte-secar","lavado-corte-peinar","peinar","cortar-caballero-nino","cortar-anadido","color-organico","color-10-minutos","bano-brillo","barros","mechas","mechas-matiz","money-piece","matiz","ahuecador","ozonoterapia","diagnostico-camara","dermapen","hidrobalance","barros-cuero-cabelludo","hidratacion-intensiva","proteinas","tipo-bx","olaplex","olaplex-quelante","reconstructor-rizos","nanokeratinizacion","hyaluroplastia","combonano","barros-tratantes","keratina","keratina-plus","spa-japones-cabeza","spa-japones-cabeza-facial","maquillaje-correccion","peluqueria-focos","novias"]},{"id":"color-previo","texto":"¿Has venido alguna vez a aplicarte aquí el color?","tipo":"si_no","obligatoria":false,"activa":true,"servicios":["color-organico","color-10-minutos","bano-brillo","barros","mechas","mechas-matiz","money-piece","matiz"]},{"id":"tratamiento-brillo","texto":"¿En tu retoque de color, quieres aprovechar el tiempo con un tratamiento de brillo e hidratación?","tipo":"si_no","obligatoria":false,"activa":true,"servicios":["color-organico","color-10-minutos"]}],
  "depositEnabled":true,
  "depositMode":"hora",
  "depositHourlyRateEur":5,
  "depositDeadlineHours":4,
  "depositAuto":false,
  "depositAutoRelease":false,
  "depositAppliesTo":"todas",
  "clientImportOrigin":"tpv123",
  "duracionFlexible":true,
  "ocultarPrecioReserva":true,
  "calendario":{"desde":9,"hasta":21},
  "plan":"reservas",
  "rating":0,
  "reviewCount":0
}
  $perfil$::jsonb;
  previo jsonb;
  resultado jsonb;
begin
  -- 0. Comprobación de supabase/pendiente.sql: sin ello fallan el aviso de
  --    privacidad y el alta de María. Si falta algo, se aborta sin escribir nada.
  if to_regclass('public.salons') is null then
    raise exception 'Falta la tabla salons: aplica primero supabase/schema.sql.';
  end if;
  if to_regclass('public.perfil_versiones') is null then
    raise exception 'Falta la tabla perfil_versiones: aplica primero supabase/pendiente.sql.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='privacy_notice_acknowledged_at') then
    raise exception 'Falta appointments.privacy_notice_acknowledged_at: aplica primero supabase/pendiente.sql.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='salon_members' and column_name='employee_id') then
    raise exception 'Falta salon_members.employee_id: aplica primero supabase/pendiente.sql.';
  end if;
  select profile into previo from salons where slug = 'peluchic' for update;
  if previo is null then
    raise exception 'No existe salons.slug=peluchic; usa seed-peluchic.sql.';
  end if;
  resultado := previo || nuevo;
  if resultado = previo then
    raise notice 'PeluChic ya tiene este perfil: no se cambia nada.';
    return;
  end if;
  insert into perfil_versiones (id, salon_slug, perfil, nota)
    values (gen_random_uuid(), 'peluchic', previo, 'antes de update-peluchic.sql');
  update salons set profile = resultado, updated_at = now() where slug = 'peluchic';
end
$actualizar$;
commit;
select slug, jsonb_array_length(profile->'menu') as servicios, profile->>'depositEnabled' as fianza_activa, updated_at,
  (select count(*) from perfil_versiones where salon_slug='peluchic' and nota='antes de update-peluchic.sql') as copias_guardadas
from salons where slug='peluchic';
