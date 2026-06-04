<!-- Sub-navigation shared by the settings pages. -->
<script lang="ts">
  import { page } from '$app/state';

  const links = [
    { href: '/settings', label: 'Profile and contact' },
    { href: '/settings/notifications', label: 'Notifications' },
    { href: '/settings/export', label: 'Your data' },
    { href: '/settings/delete-account', label: 'Leave wunan' }
  ];
</script>

<nav aria-label="Settings">
  <ul class="flex flex-wrap gap-1">
    {#each links as link (link.href)}
      <li>
        <a
          href={link.href}
          aria-current={page.url.pathname === link.href ? 'page' : undefined}
          class="inline-flex min-h-11 items-center rounded-md px-3 text-foreground no-underline hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
        >
          {link.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
