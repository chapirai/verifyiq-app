import { ReactNode } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return <table className="table-shell">{children}</table>;
}
