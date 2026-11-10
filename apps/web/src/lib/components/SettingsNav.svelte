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
  <ul class="segmented">
    {#each links as link (link.href)}
      <li>
        <a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>
          {link.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
