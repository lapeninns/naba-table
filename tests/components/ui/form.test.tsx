import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRoot,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

function EmailForm() {
  const form = useForm<{ email: string }>({ defaultValues: { email: '' } });

  return (
    <Form {...form}>
      <FormRoot onSubmit={form.handleSubmit(() => undefined)}>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: 'Email is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>We never share this.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </FormRoot>
    </Form>
  );
}

describe('ui/form', () => {
  it('@smoke @a11y wires label, control, and description ids together', () => {
    render(<EmailForm />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByText('We never share this.')).toHaveAttribute(
      'id',
      describedBy as string,
    );
  });

  it('@contract @a11y surfaces validation errors as alerts and flags the control', async () => {
    const user = userEvent.setup();
    render(<EmailForm />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    const message = await screen.findByRole('alert');
    expect(message).toHaveTextContent('Email is required');
    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true'),
    );
  });

  it('@contract clears the error once the field is valid again', async () => {
    const user = userEvent.setup();
    render(<EmailForm />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('alert');

    await user.type(screen.getByLabelText('Email'), 'ops@example.com');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
