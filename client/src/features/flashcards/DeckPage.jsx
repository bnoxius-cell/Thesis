import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Layers, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button, Card, Chip, ConfirmDialog, EmptyState, IconButton, Menu, MenuItem, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import CardDialog from "./CardDialog";
import CardForm from "./CardForm";
import CardRow from "./CardRow";
import EditDeckDialog from "./EditDeckDialog";
import { deckMeta } from "./deckWords";
import { FLASHCARDS_TAB, reviewHref } from "./flashcardLinks";
import useDeck from "./useDeck";
import "./deck.css";

const BACK = { to: FLASHCARDS_TAB, label: "Back to Practice" };
const NO_CARD = { term: "", answer: "" };

// One deck (Figma 260:705 and 260:962 with cards, 260:1118 and 260:1319 new): its meta and Study button, the
// Add a card form, then its cards. The Add form keeps focus in the Term after each card so a deck can be typed
// in a row. An unknown or foreign id shows "Deck not found" (262:2548).
export default function DeckPage() {
  const { deckId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const data = useDeck(deckId);
  const termRef = useRef(null);
  const [draft, setDraft] = useState(NO_CARD);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [dialog, setDialog] = useState(null); // { kind: "card" | "deleteCard" | "deck" | "deleteDeck", card? }
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { deck, cards, status } = data;

  if (status !== "loaded") {
    return (
      <Page title="Flashcards" back={BACK}>
        {status === "loading" && (
          <div className="deck-body" role="status" aria-label="Loading this deck">
            <Skeleton className="deck-skeleton" height="64px" />
            <Skeleton className="deck-skeleton" height="260px" />
          </div>
        )}
        {status === "missing" && (
          <EmptyState icon={Layers} title="This deck isn't here anymore" actions={<Button variant="secondary" to={FLASHCARDS_TAB}>Back to flashcards</Button>}>
            It may have been deleted, or the link is old.
          </EmptyState>
        )}
        {status === "failed" && (
          <div className="deck-failed" role="alert">
            <p>{data.error}</p>
            <Button variant="secondary" onClick={data.reload}>Try again</Button>
          </div>
        )}
      </Page>
    );
  }

  const empty = cards.length === 0;
  const ready = draft.term.trim() !== "" && draft.answer.trim() !== "";
  const closeDialog = () => setDialog(null);

  const submit = async (event) => {
    event.preventDefault();
    if (adding || !ready) return;
    setAdding(true);
    setAddError("");
    const { error } = await data.add({ term: draft.term.trim(), answer: draft.answer.trim() });
    setAdding(false);
    if (error) return setAddError(error);
    setDraft(NO_CARD);
    termRef.current?.focus();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    const isDeck = dialog.kind === "deleteDeck";
    const { error } = await (isDeck ? data.removeDeck() : data.removeCard(dialog.card.id));
    setDeleting(false);
    if (error) return setDeleteError(error);
    if (isDeck) {
      toast.success("Deck deleted.");
      navigate(FLASHCARDS_TAB, { replace: true });
    } else {
      closeDialog();
    }
  };

  return (
    <Page title={deck.title} back={BACK}>
      <div className="deck-body">
        <div className="deck-head">
          <div className="deck-meta">
            <span>{deckMeta(deck)}</span>
            {deck.course && <Chip tone="neutral">{deck.course}</Chip>}
          </div>
          <div className="deck-actions">
            <Button
              className="deck-actions__study"
              {...(empty
                ? { disabled: true, "aria-describedby": "deck-study-hint" }
                : { to: reviewHref(deck.id), state: { from: location.pathname } })}
            >
              Study
            </Button>
            <Menu
              align="end"
              label={`Actions for ${deck.title}`}
              trigger={(props) => <IconButton plain icon={MoreHorizontal} label="More for this deck" {...props} />}
            >
              <MenuItem icon={Pencil} onSelect={() => setDialog({ kind: "deck" })}>Edit deck</MenuItem>
              <MenuItem icon={Trash2} tone="danger" onSelect={() => setDialog({ kind: "deleteDeck" })}>Delete deck</MenuItem>
            </Menu>
          </div>
          {empty && <p id="deck-study-hint" className="deck-hint">Add a card to start studying.</p>}
        </div>

        <Card as="section" className="deck-add" aria-labelledby="deck-add-title">
          <h2 id="deck-add-title" className="deck-heading">Add a card</h2>
          {empty && <p className="deck-add__intro">Add your first card. Put the word or question on top and what you want to remember underneath.</p>}
          <form className="deck-add__form" onSubmit={submit} noValidate>
            <CardForm term={draft.term} answer={draft.answer} onChange={(part) => setDraft((prev) => ({ ...prev, ...part }))} termRef={termRef} autoFocus={empty} />
            {addError && <p className="deck-error" role="alert">{addError}</p>}
            <div className="deck-add__row">
              <Button type="submit" busy={adding} disabled={!ready}>Add card</Button>
            </div>
          </form>
        </Card>

        {!empty && (
          <section aria-labelledby="deck-cards-title" className="deck-cards">
            <h2 id="deck-cards-title" className="deck-heading">
              Cards <span className="deck-cards__count">{cards.length}</span>
            </h2>
            <ul className="deck-cards__list stagger">
              {cards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  entering={card.id === data.fresh}
                  onEdit={() => setDialog({ kind: "card", card })}
                  onDelete={() => setDialog({ kind: "deleteCard", card })}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {dialog?.kind === "card" && <CardDialog card={dialog.card} onSave={(fields) => data.edit(dialog.card.id, fields)} onClose={closeDialog} />}
      {dialog?.kind === "deck" && <EditDeckDialog deck={deck} onSave={data.rename} onClose={closeDialog} />}
      <ConfirmDialog
        open={dialog?.kind === "deleteCard" || dialog?.kind === "deleteDeck"}
        tone="danger"
        sheet
        title={dialog?.kind === "deleteDeck" ? "Delete this deck?" : "Delete this card?"}
        confirmLabel={dialog?.kind === "deleteDeck" ? "Delete deck" : "Delete card"}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteError("");
          closeDialog();
        }}
      >
        {dialog?.kind === "deleteDeck"
          ? `Delete ${deck.title} and its ${cards.length} ${cards.length === 1 ? "card" : "cards"}? This can't be undone.`
          : `Delete ${dialog?.card?.term}? This can't be undone.`}
        {deleteError && <span className="deck-error" role="alert"> {deleteError}</span>}
      </ConfirmDialog>
    </Page>
  );
}
