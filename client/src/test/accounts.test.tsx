import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteAccountDialog } from '../components/account';

const account = {
  id: 'user-1',
  name: 'Andi Pelanggan',
  email: 'andi@example.com',
  isPrimaryAdmin: false,
};

describe('account deletion confirmation', () => {
  it('identifies the target and requires an explicit confirmation or cancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DeleteAccountDialog
        open
        account={account}
        busy={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Andi Pelanggan')).toBeInTheDocument();
    expect(screen.getByText('andi@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Hapus akun' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('never enables deletion for the primary administrator', () => {
    render(
      <DeleteAccountDialog
        open
        account={{ ...account, isPrimaryAdmin: true }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Hapus akun' })).toBeDisabled();
    expect(screen.getByText(/dilindungi dan tidak dapat dihapus/i)).toBeInTheDocument();
  });

  it('shows a failure message and keeps the confirm action disabled while busy', () => {
    render(
      <DeleteAccountDialog
        open
        account={account}
        busy
        error="Gagal menghapus akun"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Gagal menghapus akun');
    expect(screen.getByRole('button', { name: 'Hapus akun' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
  });
});
