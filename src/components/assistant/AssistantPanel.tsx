/**
 * Asistente del panel, construido sobre las primitivas de assistant-ui
 * (https://github.com/assistant-ui/assistant-ui, MIT).
 *
 * Usamos `useLocalRuntime` con un adaptador propio: no hay backend ni clave de
 * API, las respuestas salen de `answerFor()`, que solo consulta los datos del
 * salón.
 *
 * La UI se monta con primitivas en vez de con el paquete de estilos de
 * assistant-ui para que herede los tokens del tema (carbón + latón).
 */
import { useMemo } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { ArrowUp, Bot, Square, User } from "lucide-react";
import { employees } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import { answerFor, SUGGESTIONS } from "@/lib/assistant-answers";
import { cn } from "@/lib/utils";

function useSalonAdapter(): ChatModelAdapter {
  return useMemo(
    () => ({
      async run({ messages }) {
        const last = messages[messages.length - 1];
        const question = last?.content
          .map((part) => (part.type === "text" ? part.text : ""))
          .join(" ")
          .trim();

        // Lectura directa del store: así el asistente ve siempre el estado
        // actual (citas creadas hace un segundo incluidas), no una copia
        // congelada en el momento de montar el panel.
        const s = useSalonStore.getState();
        const text = answerFor(question ?? "", {
          appointments: s.appointments,
          services: s.services,
          employees,
          waitlist: s.waitlist,
          salonName: s.salonProfile.name,
        });

        // Una sola respuesta, no un generador que la escupa palabra a palabra:
        // el cálculo es local e instantáneo, así que "escribir" poco a poco
        // solo añadiría retardo — y ataba la entrega al bucle de frames del
        // navegador, que se detiene si la pestaña no está visible.
        return { content: [{ type: "text" as const, text }] };
      },
    }),
    [],
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm border border-border/60 bg-card text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <Bubble role="user">
        <MessagePrimitive.Parts />
      </Bubble>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <Bubble role="assistant">
        <MessagePrimitive.Parts />
      </Bubble>
    </MessagePrimitive.Root>
  );
}

function Welcome() {
  const isEmpty = useAuiState((s) => s.thread.isEmpty);
  if (!isEmpty) return null;
  return (
    <div className="flex flex-col items-start gap-4 py-4">
      <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
        Pregúntame por los números de tu salón. Respondo con tus propias reservas — no invento nada
        ni consulto fuera.
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <ThreadPrimitive.Suggestion
            key={s}
            prompt={s}
            send
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

function Composer() {
  // Mientras se está escribiendo la respuesta, el botón de enviar se cambia por
  // el de detener — si no, saldrían los dos a la vez.
  const running = useAuiState((s) => s.thread.isRunning);
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t border-border/60 bg-background p-3">
      <ComposerPrimitive.Input
        rows={1}
        maxRows={5}
        placeholder="¿Cuánto he facturado hoy?"
        className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {running ? (
        <ComposerPrimitive.Cancel
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground"
          aria-label="Detener"
        >
          <Square className="size-3.5 fill-current" />
        </ComposerPrimitive.Cancel>
      ) : (
        <ComposerPrimitive.Send
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          aria-label="Enviar"
        >
          <ArrowUp className="size-4" />
        </ComposerPrimitive.Send>
      )}
    </ComposerPrimitive.Root>
  );
}

export function AssistantPanel({ className }: { className?: string }) {
  const adapter = useSalonAdapter();
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className={cn("flex min-h-0 flex-col", className)}>
        <ThreadPrimitive.Viewport className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <Welcome />
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>
        <Composer />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
