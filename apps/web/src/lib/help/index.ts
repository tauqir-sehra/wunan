// Member help, in plain language (constitution VI). One short page per topic.
import type { Component } from 'svelte';
import AskingForHelp from './AskingForHelp.svelte';
import Finding from './Finding.svelte';
import Joining from './Joining.svelte';
import Offering from './Offering.svelte';
import Notifications from './Notifications.svelte';
import Arrangements from './Arrangements.svelte';
import Requests from './Requests.svelte';
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
    slug: 'offering',
    title: 'Offering something',
    summary: 'Lending, giving, trading, and offering your time.',
    content: Offering
  },
  {
    slug: 'finding',
    title: 'Finding things',
    summary: 'Searching and narrowing down what you see.',
    content: Finding
  },
  {
    slug: 'requests',
    title: 'Asking for things',
    summary: 'Requesting what you need, how others help, and public messages.',
    content: Requests
  },
  {
    slug: 'arrangements',
    title: 'Arranging and agreeing',
    summary: 'Asking for something, talking it over, agreeing, and getting lent things back.',
    content: Arrangements
  },
  {
    slug: 'asking-for-help',
    title: 'Asking for help',
    summary: 'What to do when something you agreed doesn’t work out.',
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
