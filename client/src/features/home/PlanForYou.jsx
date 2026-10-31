import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { Card, Chip } from "@/shared/ui";
import { planCards } from "./planCards";

// Plan for you (Figma 16:121): up to four things coming up, in date order. Hidden when nothing is.
export default function PlanForYou({ tasks, exam, subjectsById, now }) {
  const cards = planCards({ tasks, exam, subjectsById, now });
  if (cards.length === 0) return null;

  return (
    <section className="home-plan" aria-labelledby="home-plan">
      <header className="home-card__head">
        <span className="home-chip home-chip--soft" aria-hidden="true"><ListChecks size={18} /></span>
        <h2 id="home-plan" className="home-card__title">Plan for you</h2>
        <Link to="/plan?view=tasks" className="home-link home-plan__all">See all</Link>
      </header>
      <ul className="home-plan__cards stagger">
        {cards.map((card) => (
          <Card as="li" key={card.id} className="home-plan__card">
            <span className="home-plan__label">
              <span className={`home-dot home-dot--${card.tone} home-dot--small`} aria-hidden="true" />
              {card.label}
            </span>
            <strong className="home-plan__title">{card.title}</strong>
            <span className="home-plan__chips">
              <Chip tone="accent">{card.when}</Chip>
              {card.size && <Chip tone="neutral">{card.size}</Chip>}
            </span>
          </Card>
        ))}
      </ul>
    </section>
  );
}
