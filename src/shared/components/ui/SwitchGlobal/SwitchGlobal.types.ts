import type { ReactNode } from 'react';

export type SwitchOption = {
  key: string;
  component: ReactNode;
};

export type SwitchGlobalProps = {
  options: SwitchOption[];
  /** key активной опции — только для позиции индикатора */
  value: string;
  onChange?: (key: string) => void;
  /** true — все ячейки flex-1; false — ширина по контенту */
  equalWidth?: boolean;
  /** NativeWind-стили контейнера */
  className?: string;
  /** NativeWind-стили индикатора */
  sliderClassName?: string;
};
