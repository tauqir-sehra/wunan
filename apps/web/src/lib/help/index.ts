// Member help, in plain language (constitution VI). One short page per topic.
import type { Component } from 'svelte';
import AskingForHelp from './AskingForHelp.svelte';
import Agreements from './Agreements.svelte';
import Finding from './Finding.svelte';
import Joining from './Joining.svelte';
import Listing from './Listing.svelte';
import Messages from './Messages.svelte';
import Notifications from './Notifications.svelte';
import YourData from './YourData.svelte';

export type HelpTopic = { slug: string; title: string; summary: string; content: Component };

export const helpTopics: HelpTopic[] = [
  {
    slug: 'joining',
    title: 'Joining and invitations',
    summary: 'How invitations work, and inviting people you know.',
    content: Joining
  },
  {
    slug: 'listing',
    title: 'Listing something',
    summary: 'Lending, giving, trading, and offering your time.',
    content: Listing
  },
  {
    slug: 'finding',
    title: 'Finding things',
    summary: 'Searching and narrowing down what you see.',
    content: Finding
  },
  {
    slug: 'messages',
    title: 'Messages and contact details',
    summary: 'Talking to members and sharing your phone number safely.',
    content: Messages
  },
  {
    slug: 'agreements',
    title: 'Recording an agreement',
    summary: 'Keeping track of what you lent, gave or traded.',
    content: Agreements
  },
  {
    slug: 'asking-for-help',
    title: 'Asking for help',
    summary: 'What to do when an agreement doesn’t work out.',
    content: AskingForHelp
  },
  {
    slug: 'notifications',
    title: 'Notifications',
    summary: 'Choosing what wunan tells you about, and how.',
    content: Notifications
  },
  {
    slug: 'your-data',
    title: 'Your data and leaving',
    summary: 'Who sees what, downloading your data, and deleting your account.',
    content: YourData
  }
];
