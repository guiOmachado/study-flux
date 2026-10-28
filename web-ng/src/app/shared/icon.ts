import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  library: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM9 4h5.5A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5H9M16 6l3.2.8a1.5 1.5 0 0 1 1.1 1.8l-2.2 9.7',
  upload: 'M12 16V4m0 0 4 4m-4-4-4 4M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16',
  play: 'M8 5.5v13l10-6.5-10-6.5Z',
  chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  layers: 'M12 3 3 7.5l9 4.5 9-4.5L12 3ZM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z',
  logout: 'M15 17l5-5-5-5M20 12H9M12 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H12',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9L19 15Z',
  check: 'M4.5 12.5 9 17l10.5-10.5',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 8v5m0 3.5v.5M10.3 4.3 2.8 17.2A1.8 1.8 0 0 0 4.4 20h15.2a1.8 1.8 0 0 0 1.6-2.8L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  flame: 'M12 21c3.9 0 6.5-2.6 6.5-6.2 0-4.6-4.2-6.9-4.2-10.8-2.2.8-3.6 3-3.6 5.1 0 1-.4 1.9-1 2.4-1-1.1-1.5-2.4-1.5-2.4-1.3 1.6-2.7 3.4-2.7 5.7C5.5 18.4 8.1 21 12 21Z',
  trash: 'M4 7h16M9 7V4h6v3M6.5 7l.8 12.1A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7',
  edit: 'M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4',
  copy: 'M9 9h9.5A1.5 1.5 0 0 1 20 10.5V20a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20v-9.5A1.5 1.5 0 0 1 9 9ZM4 15V4.5A1.5 1.5 0 0 1 5.5 3H15',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M4 18v1.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V18',
  arrowRight: 'M5 12h14m0 0-6-6m6 6-6 6',
  arrowLeft: 'M19 12H5m0 0 6-6m-6 6 6 6',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM14.1 9.9a3 3 0 1 1-4.2 4.2 3 3 0 0 1 4.2-4.2Z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  brain: 'M9.5 4.5A3 3 0 0 0 6.5 7v.5A3 3 0 0 0 5 10.2v1.6A3 3 0 0 0 6.5 17v.5a3 3 0 0 0 5 2.1V4.9a3 3 0 0 0-2-0.4ZM14.5 4.5A3 3 0 0 1 17.5 7v.5A3 3 0 0 1 19 10.2v1.6A3 3 0 0 1 17.5 17v.5a3 3 0 0 1-5 2.1',
  stethoscope:
    'M5 3v5a4 4 0 0 0 8 0V3M3 3h4m4 0h4M9 16v-4M9 20a4 4 0 0 0 8 0v-3M19.5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  filter: 'M4 5h16l-6.5 8v6l-3-2v-4L4 5Z',
  folder: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-10Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 10v6M12 7.2v.3',
  bookmark: 'M6 4h12v17l-6-4-6 4V4Z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3c2.4 2.4 3.6 5.4 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.4-3.6-9S9.6 5.4 12 3Z',
  bookOpen: 'M12 6.5C10.4 5.2 8.3 4.6 5 4.6v13c3.3 0 5.4.6 7 1.9 1.6-1.3 3.7-1.9 7-1.9v-13c-3.3 0-5.4.6-7 1.9ZM12 6.5v13',
  link: 'M10 13a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.4 6M14 11a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.3',
  graduation: 'M3 9.5 12 5l9 4.5-9 4.5-9-4.5ZM7 11.5V16c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5M21 9.5V15',
  language: 'M4 6h9M8.5 4.5V6c0 3.6-2 6.6-5 8.5M6 10.5c1 2.3 2.8 3.9 5 4.5M14 20l3.5-9 3.5 9M15.3 17h4.4',
  lock: 'M6 10.5h12v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-9ZM8.5 10.5V7a3.5 3.5 0 1 1 7 0v3.5M12 15v2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0',
};

@Component({
  selector: 'sf-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: [':host { display: inline-flex; align-items: center; justify-content: center; flex: none; }'],
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(18);
  readonly strokeWidth = input(1.8);
  readonly path = computed(() => PATHS[this.name()] ?? PATHS['info']);
}

/** Logo da marca (mesmo desenho do favicon). */
@Component({
  selector: 'sf-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path
        d="M7 17h4l2.2-5 3.2 10 2.6-6.3 1.4 3.3H25"
        stroke="white"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: [':host { display: inline-flex; flex: none; }'],
})
export class Logo {
  readonly size = input(32);
}
