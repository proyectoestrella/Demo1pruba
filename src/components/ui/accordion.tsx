import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { debeAnimarAcordeon } from "@/lib/accordion-animation";
import { cn } from "@/lib/utils";

const AccordionAnimationContext = React.createContext({
  animar: false,
  registrarInteraccion: () => undefined,
});

type AccordionProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>;

/**
 * El HTML inicial puede traer una sección ya abierta. No se anima hasta que
 * alguien cambia el acordeón: así la hidratación no encoge y vuelve a abrir el
 * contenido que ya ocupaba su sitio en el documento servido.
 */
const Accordion = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  AccordionProps
>(({ ...props }, ref) => {
  const [haInteractuado, setHaInteractuado] = React.useState(false);
  const registrarInteraccion = React.useCallback(() => setHaInteractuado(true), []);

  return (
    <AccordionAnimationContext.Provider
      value={{ animar: debeAnimarAcordeon(haInteractuado), registrarInteraccion }}
    >
      <AccordionPrimitive.Root ref={ref} {...props} />
    </AccordionAnimationContext.Provider>
  );
});
Accordion.displayName = AccordionPrimitive.Root.displayName;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    /** Nivel semántico del título del acordeón; por defecto Radix usa h3. */
    headingLevel?: 2 | 3 | 4 | 5 | 6;
  }
>(({ className, children, headingLevel = 3, onPointerDown, onKeyDown, ...props }, ref) => {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";
  const { registrarInteraccion } = React.useContext(AccordionAnimationContext);
  return (
    <AccordionPrimitive.Header asChild>
      <Heading className="flex">
        <AccordionPrimitive.Trigger
          ref={ref}
          onPointerDown={(event) => {
            registrarInteraccion();
            onPointerDown?.(event);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") registrarInteraccion();
            onKeyDown?.(event);
          }}
          className={cn(
            "flex flex-1 items-center justify-between py-4 text-sm font-medium cursor-pointer transition-all hover:underline text-left [&[data-state=open]>svg]:rotate-180",
            className,
          )}
          {...props}
        >
          {children}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        </AccordionPrimitive.Trigger>
      </Heading>
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { animar } = React.useContext(AccordionAnimationContext);

  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        "overflow-hidden text-sm",
        animar &&
          "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      )}
      {...props}
    >
      <div className={cn("pb-4 pt-0", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
});
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
