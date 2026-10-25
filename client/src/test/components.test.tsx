import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, StatusBadge } from '../components/ui';
import { Stars } from '../components/common';

describe('design-system components', () => {
  it('renders a badge with its content', () => {
    render(<Badge tone="green">Lunas</Badge>);
    expect(screen.getByText('Lunas')).toBeInTheDocument();
  });

  it('applies the correct status tone for completed orders', () => {
    render(<StatusBadge status="completed" label="Selesai" />);
    const badge = screen.getByText('Selesai').closest('span');
    expect(badge).toHaveClass('bg-emerald-50');
  });

  it('renders five stars and exposes an accessible rating label', () => {
    const { container } = render(<Stars value={4} />);
    expect(screen.getByLabelText('Rating 4 dari 5')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(5);
  });
});
