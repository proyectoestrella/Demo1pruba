import { createFileRoute, Link } from "@tanstack/react-router";
import { useDisplayProfile } from "@/lib/use-display-profile";

export const Route = createFileRoute("/s/$salonSlug/privacidad")({ component: SalonPrivacy });

function SalonPrivacy() {
  const { salonSlug } = Route.useParams();
  const profile = useDisplayProfile();

  // TODO: texto de plantilla pendiente de revisión legal antes de usarlo en producción.
  return <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
    <p className="text-xs uppercase tracking-widest text-primary">Tu privacidad</p>
    <h1 className="mt-3 font-display text-3xl">Cómo tratamos tus datos</h1>
    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
      Al pedir cita, {profile.name} usa los datos que nos das para organizar tu visita y mantener el historial de los servicios que te hemos prestado.
    </p>
    <div className="mt-8 space-y-6 text-sm leading-relaxed">
      <section><h2 className="font-semibold">Quién es responsable</h2><p>{profile.name}, {profile.address || "dirección pendiente de completar en el perfil del salón"}.</p></section>
      <section><h2 className="font-semibold">Para qué usamos tus datos</h2><p>Para gestionar tus citas, ponernos en contacto contigo por ellas y conservar el historial de tus servicios.</p></section>
      <section><h2 className="font-semibold">Por qué podemos hacerlo</h2><p>Porque nos pides una cita y te prestamos el servicio.</p></section>
      <section><h2 className="font-semibold">Cuánto tiempo los guardamos</h2><p>Mientras sean necesarios para gestionar tus citas y el historial de servicios, y después durante los plazos legales que correspondan.</p></section>
      <section><h2 className="font-semibold">Tus derechos</h2><p>Puedes pedir acceso, corrección, eliminación o portabilidad de tus datos, o limitar u oponerte a su uso. Para hacerlo, contacta con {profile.name} en {profile.address || "la dirección del salón"}{profile.phone ? ` o en el ${profile.phone}` : ""}. También puedes reclamar ante la Agencia Española de Protección de Datos.</p></section>
      <section><h2 className="font-semibold">Quién nos ayuda a gestionarlos</h2><p>siShow actúa como encargado del tratamiento y proporciona la herramienta con la que el salón organiza las citas.</p></section>
    </div>
    <Link to="/s/$salonSlug" params={{ salonSlug }} search={(prev) => prev} className="mt-10 inline-block text-sm font-medium text-primary hover:underline">Volver a la web del salón</Link>
  </main>;
}
