import type { Metadata } from 'next';
import EnglishClassesClient from './EnglishClassesClient';

export const metadata: Metadata = {
  title: 'English Classes for Kids — Grammar, Phonics, Olympiad Prep | Yestoryd',
  description:
    'Structured English classes for children ages 4-12. Group or individual sessions with a certified coach, AI-tracked progress, homework feedback. Rs 199-399/session.',
  keywords:
    'english classes for kids, english tuition, grammar classes, phonics classes, olympiad prep, english classes near me, online english classes india',
  openGraph: {
    title: 'English Classes for Kids — Grammar, Phonics, Olympiad Prep | Yestoryd',
    description:
      'Structured English classes for children ages 4-12. Group or individual sessions with a certified coach.',
    url: 'https://yestoryd.com/english-classes',
    siteName: 'Yestoryd',
    type: 'website',
  },
};

export default function EnglishClassesPage() {
  return <EnglishClassesClient />;
}
