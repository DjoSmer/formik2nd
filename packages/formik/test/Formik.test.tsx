import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as Yup from 'yup';

import {
  Formik,
  FormikConfig,
  FormikProps,
  prepareDataForValidation,
  ErrorMessage,
  Field,
  useFormikSelector,
  useFormikContext,
} from '../src';
//@ts-ignore
import { noop } from './testHelpers';

jest.spyOn(global.console, 'warn');

interface Values {
  name: string;
  age?: number;
}

function Form({
  state: { status, isSubmitting },
  handleSubmit,
}: FormikProps<Values>) {
  return (
    <form onSubmit={handleSubmit} data-testid="form">
      <Field name="name" data-testid="name-input" />
      <Field name="age" data-testid="age-input" />
      <ErrorMessage name="name" component="div" id="feedback" />
      {isSubmitting && <div id="submitting">Submitting</div>}
      {status && !!status.myStatusMessage && (
        <div id="statusMessage">{status.myStatusMessage}</div>
      )}
      <button type="submit" data-testid="submit-button">
        Submit
      </button>
    </form>
  );
}

const InitialValues = {
  name: 'jared',
  age: 30,
};

function renderFormik<V = Values>(props?: Partial<FormikConfig<V>>) {
  let injected: FormikProps<V>;
  const { rerender, ...rest } = render(
    <Formik
      onSubmit={noop as any}
      initialValues={InitialValues as any}
      {...props}
    >
      {(formikProps) => {
        injected = formikProps;
        return <Form {...(formikProps as unknown as FormikProps<Values>)} />;
      }}
    </Formik>
  );
  return {
    getProps(): FormikProps<V> {
      return injected;
    },
    ...rest,
    rerender: () =>
      rerender(
        <Formik
          onSubmit={noop as any}
          initialValues={InitialValues as any}
          {...props}
        >
          {(formikProps) =>
            (injected = formikProps) && (
              <Form {...(formikProps as unknown as FormikProps<Values>)} />
            )
          }
        </Formik>
      ),
  };
}

describe('<Formik>', () => {
  it('should initialize Formik state and pass down props', () => {
    const { getProps } = renderFormik();
    const props = getProps();
    const state = props.state;

    expect(state.isSubmitting).toBe(false);
    expect(state.touched).toEqual({});
    expect(state.values).toEqual(InitialValues);
    expect(state.errors).toEqual({});
    expect(props.isDirty()).toBe(false);
    expect(props.isValid()).toBe(true);
    expect(state.submitCount).toBe(0);
  });

  describe('handleChange', () => {
    it('updates values based on name attribute', () => {
      const { getProps, getByTestId } = renderFormik<Values>();

      expect(getProps().state.values.name).toEqual(InitialValues.name);

      const input = getByTestId('name-input');
      act(() => {
        fireEvent.change(input, {
          persist: noop,
          target: {
            name: 'name',
            value: 'ian',
          },
        });
      });

      expect(getProps().state.values.name).toEqual('ian');
    });

    it('updates values when passed a string (overloaded)', () => {
      let injected: any;
      const { getByTestId } = render(
        <Formik initialValues={InitialValues} onSubmit={noop}>
          {(formikProps) =>
            (injected = formikProps) && (
              <input
                onChange={formikProps.handleChange('name')}
                data-testid="name-input"
              />
            )
          }
        </Formik>
      );
      const input = getByTestId('name-input');

      expect(injected.state.values.name).toEqual(InitialValues.name);

      act(() => {
        fireEvent.change(input, {
          persist: noop,
          target: {
            name: 'name',
            value: 'ian',
          },
        });
      });

      expect(injected.state.values.name).toEqual('ian');
    });

    it('updates values via `name` instead of `id` attribute when both are present', () => {
      const { getProps, getByTestId } = renderFormik<Values>();

      expect(getProps().state.values.name).toEqual(InitialValues.name);

      const input = getByTestId('name-input');
      act(() => {
        fireEvent.change(input, {
          persist: noop,
          target: {
            id: 'person-1-thinger',
            name: 'name',
            value: 'ian',
          },
        });
      });

      expect(getProps().state.values.name).toEqual('ian');
    });

    it('updates values when passed a string 2 (overloaded)', () => {
      let injected: any;
      render(
        <Formik initialValues={InitialValues} onSubmit={noop}>
          {(formikProps) =>
            (injected = formikProps) && (
              <input
                onChange={formikProps.handleChange('name')}
                data-testid="name-input"
              />
            )
          }
        </Formik>
      );
      const input = screen.getByTestId('name-input');

      expect(injected.state.values.name).toEqual('jared');

      act(() => {
        fireEvent.change(input, {
          target: {
            name: 'name',
            value: 'ian',
          },
        });
      });

      expect(injected.state.values.name).toEqual('ian');
    });

    it('runs validations by default', async () => {
      const validate = jest.fn(() => Promise.resolve());
      const validationSchema = {
        validate,
      };
      const { rerender } = renderFormik({
        validate,
        validationSchema,
      });

      await act(() => {
        fireEvent.change(screen.getByTestId('name-input'), {
          persist: noop,
          target: {
            name: 'name',
            value: 'ian',
          },
        });
      });

      rerender();
      await waitFor(() => {
        expect(validate).toHaveBeenCalledTimes(2);
      });
    });

    it('does NOT run validations if validateOnChange is false', async () => {
      const validate = jest.fn(() => Promise.resolve());
      const validationSchema = {
        validate,
      };
      const { rerender } = renderFormik({
        validate,
        validationSchema,
        validateOnChange: false,
      });

      act(() => {
        fireEvent.change(screen.getByTestId('name-input'), {
          persist: noop,
          target: {
            name: 'name',
            value: 'ian',
          },
        });
      });
      rerender();
      await waitFor(() => {
        expect(validate).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleBlur', () => {
    it('sets touched state', () => {
      const { getProps } = renderFormik<Values>();
      expect(getProps().state.touched.name).toEqual(undefined);

      const input = screen.getByTestId('name-input');
      act(() => {
        fireEvent.blur(input, {
          target: {
            name: 'name',
          },
        });
      });
      expect(getProps().state.touched.name).toEqual(true);
    });

    it('updates touched state via `name` instead of `id` attribute when both are present', () => {
      const { getProps } = renderFormik<Values>();
      expect(getProps().state.touched.name).toEqual(undefined);

      const input = screen.getByTestId('name-input');
      act(() => {
        fireEvent.blur(input, {
          target: {
            id: 'blah',
            name: 'name',
          },
        });
      });
      expect(getProps().state.touched.name).toEqual(true);
    });

    it('updates touched when passed a string (overloaded)', () => {
      let injected: any;
      render(
        <Formik initialValues={InitialValues} onSubmit={noop}>
          {(formikProps) =>
            (injected = formikProps) && (
              <input
                onBlur={formikProps.handleBlur('name')}
                data-testid="name-input"
              />
            )
          }
        </Formik>
      );
      const input = screen.getByTestId('name-input');

      expect(injected.state.touched.name).toEqual(undefined);
      act(() => {
        fireEvent.blur(input, {
          target: {
            name: 'name',
            value: 'ian',
          },
        });
      });
      expect(injected.state.touched.name).toEqual(true);
    });

    it('runs validate by default', async () => {
      const validate = jest.fn(noop);
      const { rerender } = renderFormik({ validate });

      await act(() => {
        fireEvent.blur(screen.getByTestId('name-input'), {
          target: {
            name: 'name',
          },
        });
      });
      rerender();
      await waitFor(() => {
        expect(validate).toHaveBeenCalled();
      });
    });

    it('runs validations by default', async () => {
      const validate = jest.fn(() => Promise.resolve());
      const validationSchema = {
        validate,
      };
      const { rerender } = renderFormik({
        validate,
        validationSchema,
      });

      await act(() => {
        fireEvent.blur(screen.getByTestId('name-input'), {
          target: {
            name: 'name',
          },
        });
      });
      rerender();
      await waitFor(() => {
        expect(validate).toHaveBeenCalledTimes(2);
      });
    });

    it('runs validations if validateOnBlur is true (default)', async () => {
      const validate = jest.fn(() => Promise.resolve());
      const validationSchema = {
        validate,
      };
      const { rerender } = renderFormik({
        validate,
        validationSchema,
      });

      await act(() => {
        fireEvent.blur(screen.getByTestId('name-input'), {
          target: {
            name: 'name',
          },
        });
      });
      rerender();
      await waitFor(() => {
        expect(validate).toHaveBeenCalledTimes(2);
      });
    });

    it('dost NOT run validations if validateOnBlur is false', async () => {
      const validate = jest.fn(() => Promise.resolve());
      const validationSchema = {
        validate,
      };
      const { rerender } = renderFormik({
        validate,
        validationSchema,
        validateOnBlur: false,
      });
      rerender();
      await waitFor(() => expect(validate).not.toHaveBeenCalled());
    });
  });

  describe('handleSubmit', () => {
    it('should call preventDefault()', () => {
      const preventDefault = jest.fn();
      const FormPreventDefault = (
        <Formik initialValues={{ name: 'jared' }} onSubmit={noop}>
          {({ handleSubmit }) => (
            <button
              data-testid="submit-button"
              onClick={() => handleSubmit({ preventDefault } as any)}
            />
          )}
        </Formik>
      );

      render(FormPreventDefault);
      act(() => {
        fireEvent.click(screen.getByTestId('submit-button'));
      });

      expect(preventDefault).toHaveBeenCalled();
    });

    it('should not error if called without an event', () => {
      const FormNoEvent = (
        <Formik initialValues={{ name: 'jared' }} onSubmit={noop}>
          {({ handleSubmit }) => (
            <button
              data-testid="submit-button"
              onClick={() =>
                handleSubmit(undefined as any /* undefined event */)
              }
            />
          )}
        </Formik>
      );

      render(FormNoEvent);

      expect(() => {
        fireEvent.click(screen.getByTestId('submit-button'));
      }).not.toThrow();
    });

    it('should not error if called without preventDefault property', () => {
      const FormNoPreventDefault = (
        <Formik initialValues={{ name: 'jared' }} onSubmit={noop}>
          {({ handleSubmit }) => (
            <button
              data-testid="submit-button"
              onClick={() => handleSubmit({} as any /* undefined event */)}
            />
          )}
        </Formik>
      );

      render(FormNoPreventDefault);

      expect(() => {
        fireEvent.click(screen.getByTestId('submit-button'));
      }).not.toThrow();
    });

    it('should not error if onSubmit throws an error', () => {
      const FormNoPreventDefault = (
        <Formik
          initialValues={{ name: 'jared' }}
          onSubmit={() => Promise.reject('oops')}
        >
          {({ handleSubmit }) => (
            <button
              data-testid="submit-button"
              onClick={() =>
                handleSubmit(undefined as any /* undefined event */)
              }
            />
          )}
        </Formik>
      );

      render(FormNoPreventDefault);

      expect(() => {
        fireEvent.click(screen.getByTestId('submit-button'));
      }).not.toThrow();
    });

    it('should touch all fields', () => {
      const { getProps } = renderFormik();
      expect(getProps().state.touched).toEqual({});

      act(() => {
        fireEvent.submit(screen.getByTestId('form'));
      });
      expect(getProps().state.touched).toEqual({ name: true, age: true });
    });

    it('should push submission state changes to child component', () => {
      const { getProps, getByTestId } = renderFormik();
      expect(getProps().state.isSubmitting).toBeFalsy();

      act(() => {
        fireEvent.submit(getByTestId('form'));
      });
      expect(getProps().state.isSubmitting).toBeTruthy();
    });

    describe('with validate (SYNC)', () => {
      it('should call validate if present', () => {
        const validate = jest.fn(() => ({}));
        const { getByTestId } = renderFormik({ validate });
        act(() => {
          fireEvent.submit(getByTestId('form'));
        });
        expect(validate).toHaveBeenCalled();
      });

      it('should submit the form if valid', async () => {
        const onSubmit = jest.fn();
        const validate = jest.fn(() => ({}));
        const { getByTestId } = renderFormik({ onSubmit, validate });

        act(() => {
          fireEvent.submit(getByTestId('form'));
        });
        await waitFor(() => expect(onSubmit).toBeCalled());
      });

      it('should not submit the form if invalid', () => {
        const onSubmit = jest.fn();
        const validate = jest.fn(() => ({ name: 'Error!' }));
        const { getByTestId } = renderFormik({ onSubmit, validate });

        act(() => {
          fireEvent.submit(getByTestId('form'));
        });
        expect(onSubmit).not.toBeCalled();
      });

      it('should not submit the form if validate function throws an error', async () => {
        global.console.warn = jest.fn();
        const onSubmit = jest.fn();
        const err = new Error('Async Error');
        const validate = jest.fn().mockRejectedValue(err);
        const { getProps } = renderFormik({
          onSubmit,
          validate,
        });

        await act(async () => {
          await expect(getProps().submitForm()).rejects.toThrow('Async Error');
        });

        await waitFor(() => {
          expect(onSubmit).not.toBeCalled();
          expect(global.console.warn).toHaveBeenCalledWith(
            expect.stringMatching(
              /Warning: An unhandled error was caught during validation in <Formik validate ./
            ),
            err
          );
        });
      });

      describe('submitForm helper should not break promise chain if handleSubmit has returned rejected Promise', () => {
        it('submitForm helper should not break promise chain if handleSubmit has returned rejected Promise', async () => {
          const error = new Error('This Error is typeof Error');
          const handleSubmit = () => {
            return Promise.reject(error);
          };
          const { getProps } = renderFormik({ onSubmit: handleSubmit });

          const { submitForm } = getProps();
          await act(async () => {
            await expect(submitForm()).rejects.toEqual(error);
          });
        });
      });
    });

    describe('with validate (ASYNC)', () => {
      it('should call validate if present', () => {
        const validate = jest.fn(() => Promise.resolve({}));
        const { getByTestId } = renderFormik({ validate });

        act(() => {
          fireEvent.submit(getByTestId('form'));
        });
        expect(validate).toHaveBeenCalled();
      });

      it('should submit the form if valid', async () => {
        const onSubmit = jest.fn();
        const validate = jest.fn(() => Promise.resolve({}));
        const { getByTestId } = renderFormik({ onSubmit, validate });

        act(() => {
          fireEvent.submit(getByTestId('form'));
        });
        await waitFor(() => expect(onSubmit).toBeCalled());
      });

      it('should not submit the form if invalid', () => {
        const onSubmit = jest.fn();
        const validate = jest.fn(() => Promise.resolve({ name: 'Error!' }));
        const { getByTestId } = renderFormik({ onSubmit, validate });

        act(() => {
          fireEvent.submit(getByTestId('form'));
        });
        expect(onSubmit).not.toBeCalled();
      });

      it('should not submit the form if validate function rejects with an error', async () => {
        global.console.warn = jest.fn();
        const onSubmit = jest.fn();
        const err = new Error('Async Error');
        const validate = jest.fn().mockRejectedValue(err);

        const { getProps } = renderFormik({ onSubmit, validate });

        await act(async () => {
          await expect(getProps().submitForm()).rejects.toThrow('Async Error');
        });

        await waitFor(() => {
          expect(onSubmit).not.toBeCalled();
          expect(global.console.warn).toHaveBeenCalledWith(
            expect.stringMatching(
              /Warning: An unhandled error was caught during validation in <Formik validate ./
            ),
            err
          );
        });
      });
    });

    describe('with validationSchema (ASYNC)', () => {
      it('should run validationSchema if present', async () => {
        const validate = jest.fn(() => Promise.resolve({}));
        const validationSchema = {
          validate,
        };
        renderFormik({
          validate,
          validationSchema,
        });

        await act(async () => {
          await fireEvent.submit(screen.getByTestId('form'));
        });

        expect(validate).toHaveBeenCalled();
      });

      it('should call validationSchema if it is a function and present', async () => {
        const validate = jest.fn(() => Promise.resolve({}));
        const validationSchema = () => ({
          validate,
        });
        renderFormik({
          validate,
          validationSchema,
        });

        await act(async () => {
          await fireEvent.submit(screen.getByTestId('form'));
        });
        expect(validate).toHaveBeenCalled();
      });
    });

    describe('FormikHelpers', () => {
      it('setValues sets values', () => {
        const { getProps } = renderFormik<Values>();

        act(() => {
          getProps().setValues({ name: 'ian', age: 25 });
        });
        expect(getProps().state.values.name).toEqual('ian');
        expect(getProps().state.values.age).toEqual(25);
      });

      it('setValues takes a function which can patch values', () => {
        const { getProps } = renderFormik<Values>();

        act(() => {
          getProps().setValues((values: Values) => ({
            ...values,
            age: 80,
          }));
        });
        expect(getProps().state.values.name).toEqual('jared');
        expect(getProps().state.values.age).toEqual(80);
      });

      it('setValues should run validations when validateOnChange is true (default)', async () => {
        const newValue: Values = { name: 'ian', age: 20 };
        const validate = jest.fn((_values) => ({}));
        const { getProps } = renderFormik({ validate });

        await act(() => {
          getProps().setValues(newValue);
        });
        // rerender();
        await waitFor(() => {
          expect(validate).toHaveBeenCalledWith(newValue, undefined);
        });
      });
      it('setValues should NOT run validations when validateOnChange is false', async () => {
        const validate = jest.fn();
        const { getProps, rerender } = renderFormik<Values>({
          validate,
          validateOnChange: false,
        });

        await act(() => {
          getProps().setValues({ name: 'ian', age: 20 });
        });
        rerender();
        await waitFor(() => {
          expect(validate).not.toHaveBeenCalled();
        });
      });

      it('setFieldValue sets value by key', async () => {
        const { getProps, rerender } = renderFormik<Values>();

        await act(() => {
          getProps().setFieldValue('name', 'ian');
        });
        rerender();
        await waitFor(() => {
          expect(getProps().state.values.name).toEqual('ian');
        });
      });

      it('setFieldValue should run validations when validateOnChange is true (default)', async () => {
        const validate = jest.fn(() => ({}));
        const { getProps, rerender } = renderFormik({ validate });

        await act(() => {
          getProps().setFieldValue('name', 'ian');
        });
        rerender();
        await waitFor(() => {
          expect(validate).toHaveBeenCalled();
        });
      });

      it('setFieldValue should NOT run validations when validateOnChange is false', async () => {
        const validate = jest.fn();
        const { getProps, rerender } = renderFormik({
          validate,
          validateOnChange: false,
        });

        await act(() => {
          getProps().setFieldValue('name', 'ian');
        });
        rerender();
        await waitFor(() => {
          expect(validate).not.toHaveBeenCalled();
        });
      });

      it('setTouched sets touched', () => {
        const { getProps } = renderFormik();

        act(() => {
          getProps().setTouched({ name: true });
        });
        expect(getProps().state.touched).toEqual({ name: true });
      });

      it('setTouched should NOT run validations when validateOnChange is true (default)', async () => {
        const validate = jest.fn(() => ({}));
        const { getProps, rerender } = renderFormik({ validate });

        await act(() => {
          getProps().setTouched({ name: true });
        });
        rerender();
        await waitFor(() => expect(validate).toHaveBeenCalled());
      });

      it('setTouched should run validations when validateOnBlur is false', async () => {
        const validate = jest.fn(() => ({}));
        const { getProps, rerender } = renderFormik({
          validate,
          validateOnBlur: false,
        });

        await act(() => {
          getProps().setTouched({ name: true });
        });
        rerender();
        await waitFor(() => expect(validate).not.toHaveBeenCalled());
      });

      it('setFieldTouched sets touched by key', () => {
        const { getProps } = renderFormik<Values>();

        act(() => {
          getProps().setFieldTouched('name', true);
        });
        expect(getProps().state.touched).toEqual({ name: true });
        expect(getProps().isDirty()).toBe(false);

        act(() => {
          getProps().setFieldTouched('name', false);
        });
        expect(getProps().state.touched).toEqual({ name: false });
        expect(getProps().isDirty()).toBe(false);
      });

      it('setFieldTouched should run validations when validateOnBlur is true (default)', async () => {
        const validate = jest.fn(() => ({}));
        const { getProps, rerender } = renderFormik({ validate });

        await act(() => {
          getProps().setFieldTouched('name', true);
        });
        rerender();
        await waitFor(() => expect(validate).toHaveBeenCalled());
      });

      it('setFieldTouched should NOT run validations when validateOnBlur is false', async () => {
        const validate = jest.fn(() => ({}));
        const { getProps, rerender } = renderFormik({
          validate,
          validateOnBlur: false,
        });

        await act(() => {
          getProps().setFieldTouched('name', true);
        });
        rerender();
        await waitFor(() => expect(validate).not.toHaveBeenCalled());
      });

      it('setErrors sets error object', () => {
        const { getProps } = renderFormik<Values>();

        act(() => {
          getProps().setErrors({ name: 'Required' });
        });
        expect(getProps().state.errors.name).toEqual('Required');
      });

      it('setFieldError sets error by key', () => {
        const { getProps } = renderFormik<Values>();

        act(() => {
          getProps().setFieldError('name', 'Required');
        });
        expect(getProps().state.errors.name).toEqual('Required');
      });

      it('setStatus sets status object', () => {
        const { getProps } = renderFormik();

        const status = 'status';
        act(() => {
          getProps().setStatus(status);
        });

        expect(getProps().state.status).toEqual(status);
      });
    });
  });

  describe('FormikComputedProps', () => {
    it('should compute dirty as soon as any input is touched', () => {
      const { getProps } = renderFormik();

      expect(getProps().isDirty()).toBeFalsy();
      act(() => {
        getProps().setValues({ name: 'ian', age: 27 });
      });
      expect(getProps().isDirty()).toBeTruthy();
    });

    /*it('should compute isValid if isInitialValid is present and returns true', () => {
      const { getProps } = renderFormik({ isInitialValid: () => true });

      expect(getProps().isDirty()).toBeFalsy();
      expect(getProps().isValid).toBeTruthy();
    });

    it('should compute isValid if isInitialValid is present and returns false', () => {
      const { getProps } = renderFormik({ isInitialValid: () => false });

      expect(getProps().isDirty()).toBeFalsy();
      expect(getProps().isValid).toBeFalsy();
    });

    it('should compute isValid if isInitialValid boolean is present and set to true', () => {
      const { getProps } = renderFormik({ isInitialValid: true });

      expect(getProps().isDirty()).toBeFalsy();
      expect(getProps().isValid).toBeTruthy();
    });

    it('should compute isValid if isInitialValid is present and set to false', () => {
      const { getProps } = renderFormik({ isInitialValid: false });

      expect(getProps().isDirty()).toBeFalsy();
      expect(getProps().isValid).toBeFalsy();
    });*/

    it('should compute isValid if the form is dirty and there are errors', async () => {
      const { getProps } = renderFormik();

      await act(() => {
        getProps().setValues({ name: 'ian' });
      });
      await act(() => {
        getProps().setErrors({ name: 'Required!' });
      });

      expect(getProps().isDirty()).toBeTruthy();
      expect(getProps().isValid()).toBeFalsy();
    });

    it('should compute isValid if the form is dirty and there are not errors', () => {
      const { getProps } = renderFormik();

      act(() => {
        getProps().setValues({ name: 'ian' });
      });

      expect(getProps().isDirty()).toBeTruthy();
      expect(getProps().isValid()).toBeTruthy();
    });

    it('should increase submitCount after submitting the form', () => {
      const { getProps, getByTestId } = renderFormik();

      expect(getProps().state.submitCount).toBe(0);
      act(() => {
        fireEvent.submit(getByTestId('form'));
      });
      expect(getProps().state.submitCount).toBe(1);
    });
  });

  describe('handleReset', () => {
    it('should call onReset if onReset prop is set', () => {
      const onReset = jest.fn();
      const { getProps } = renderFormik({
        initialValues: InitialValues,
        onReset: onReset,
        onSubmit: noop,
      });

      const { handleReset } = getProps();
      act(() => {
        handleReset();
      });

      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('resetForm', () => {
    it('should call onReset with values and actions when form is reset', () => {
      const onReset = jest.fn();
      const { getProps } = renderFormik({
        initialValues: InitialValues,
        onSubmit: noop,
        onReset,
      });

      act(() => {
        getProps().resetForm();
      });

      expect(onReset).toHaveBeenCalledWith(
        InitialValues,
        expect.objectContaining({
          resetForm: expect.any(Function),
          setErrors: expect.any(Function),
          setFieldError: expect.any(Function),
          setFieldTouched: expect.any(Function),
          setFieldValue: expect.any(Function),
          setStatus: expect.any(Function),
          setSubmitting: expect.any(Function),
          setTouched: expect.any(Function),
          setValues: expect.any(Function),
        })
      );
    });

    it('should not error resetting form if onReset is not a prop', () => {
      const { getProps } = renderFormik();
      act(() => {
        getProps().resetForm();
      });
      expect(true);
    });

    it('should reset dirty flag even if initialValues has changed', () => {
      const { getProps, getByTestId } = renderFormik();

      expect(getProps().isDirty()).toBeFalsy();

      const input = getByTestId('name-input');
      act(() => {
        fireEvent.change(input, {
          persist: noop,
          target: {
            name: 'name',
            value: 'Pavel',
          },
        });
      });
      expect(getProps().isDirty()).toBeTruthy();

      act(() => {
        getProps().resetForm();
      });
      expect(getProps().isDirty()).toBeFalsy();
    });

    it('should reset submitCount', () => {
      const { getProps } = renderFormik();

      act(() => {
        getProps().handleSubmit();
      });
      expect(getProps().state.submitCount).toEqual(1);

      act(() => {
        getProps().resetForm();
      });
      expect(getProps().state.submitCount).toEqual(0);
    });

    it('should reset dirty when resetting to same values', () => {
      const { getProps } = renderFormik();
      expect(getProps().isDirty()).toBe(false);

      act(() => {
        getProps().setFieldValue('name', 'jared-next');
      });
      expect(getProps().isDirty()).toBe(true);

      act(() => {
        getProps().resetForm({ values: getProps().state.values });
      });
      expect(getProps().isDirty()).toBe(false);
    });
  });

  describe('prepareDataForValidation', () => {
    it('should work correctly with instances', () => {
      class SomeClass {}

      const expected = {
        string: 'string',
        date: new Date(),
        someInstance: new SomeClass(),
      };

      const dataForValidation = prepareDataForValidation(expected);
      expect(dataForValidation).toEqual(expected);
    });

    it('should work correctly with instances in arrays', () => {
      class SomeClass {}

      const expected = {
        string: 'string',
        dateArr: [new Date(), new Date()],
        someInstanceArr: [new SomeClass(), new SomeClass()],
      };

      const dataForValidation = prepareDataForValidation(expected);
      expect(dataForValidation).toEqual(expected);
    });

    it('should work correctly with instances in objects', () => {
      class SomeClass {}

      const expected = {
        string: 'string',
        object: {
          date: new Date(),
          someInstance: new SomeClass(),
        },
      };

      const dataForValidation = prepareDataForValidation(expected);
      expect(dataForValidation).toEqual(expected);
    });

    it('should work correctly with mixed data', () => {
      const date = new Date();
      const dataForValidation = prepareDataForValidation({
        string: 'string',
        empty: '',
        arr: [],
        date,
      });
      expect(dataForValidation).toEqual({
        string: 'string',
        empty: undefined,
        arr: [],
        date,
      });
    });

    it('should work correctly for nested arrays', () => {
      const expected = {
        content: [
          ['a1', 'a2'],
          ['b1', 'b2'],
        ],
      };

      const dataForValidation = prepareDataForValidation(expected);
      expect(dataForValidation).toEqual(expected);
    });
  });

  // describe('componentDidUpdate', () => {
  //   let formik: any, initialValues: any;
  //   beforeEach(() => {
  //     initialValues = {
  //       name: 'formik',
  //       github: { repoUrl: 'https://github.com/jaredpalmer/formik' },
  //       watchers: ['ian', 'sam'],
  //     };

  //     const { getRef } = renderFormik({
  //       initialValues,
  //       enableReinitialize: true,
  //     });
  //     formik = getRef();
  //     formik.current.resetForm = jest.fn();
  //   });

  //   it('should not resetForm if new initialValues are the same as previous', () => {
  //     const newInitialValues = Object.assign({}, initialValues);
  //     formik.current.componentDidUpdate({
  //       initialValues: newInitialValues,
  //       onSubmit: noop,
  //     });
  //     expect(formik.current.resetForm).not.toHaveBeenCalled();
  //   });

  //   it('should resetForm if new initialValues are different than previous', () => {
  //     const newInitialValues = {
  //       ...initialValues,
  //       watchers: ['jared', 'ian', 'sam'],
  //     };
  //     formik.current.componentDidUpdate({
  //       initialValues: newInitialValues,
  //       onSubmit: noop,
  //     });
  //     expect(formik.current.resetForm).toHaveBeenCalled();
  //   });

  //   it('should resetForm if new initialValues are deeply different than previous', () => {
  //     const newInitialValues = {
  //       ...initialValues,
  //       github: { repoUrl: 'different' },
  //     };
  //     formik.current.componentDidUpdate({
  //       initialValues: newInitialValues,
  //       onSubmit: noop,
  //     });
  //     expect(formik.current.resetForm).toHaveBeenCalled();
  //   });

  //   it('should NOT resetForm without enableReinitialize flag', () => {
  //     const { getRef } = renderFormik({
  //       initialValues,
  //     });
  //     formik = getRef();
  //     formik.current.resetForm = jest.fn();

  //     const newInitialValues = {
  //       ...initialValues,
  //       watchers: ['jared', 'ian', 'sam'],
  //     };
  //     formik.current.componentDidUpdate({
  //       initialValues: newInitialValues,
  //       onSubmit: noop,
  //     });
  //     expect(formik.current.resetForm).not.toHaveBeenCalled();
  //   });
  // });

  it('should warn against buttons with unspecified type', () => {
    const { getByText, getByTestId } = render(
      <Formik onSubmit={noop} initialValues={{ opensource: 'yay' }}>
        {({ handleSubmit, handleChange, state: { values } }) => (
          <form onSubmit={handleSubmit} data-testid="form">
            <input
              type="text"
              onChange={handleChange}
              value={values.opensource}
              name="name"
            />
            <button>Submit</button>
          </form>
        )}
      </Formik>
    );

    const button = getByText('Submit');
    button.focus(); // sets activeElement

    act(() => {
      fireEvent.submit(getByTestId('form'));
    });

    expect(global.console.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /Warning: You submitted a Formik form using a button with an unspecified `type./
      )
    );

    button.blur(); // unsets activeElement
    (global.console.warn as jest.Mock<{}>).mockClear();
  });

  it('should not warn when button has type submit', () => {
    const { getByText, getByTestId } = render(
      <Formik onSubmit={noop} initialValues={{ opensource: 'yay' }}>
        {({ handleSubmit, handleChange, state: { values } }) => (
          <form onSubmit={handleSubmit} data-testid="form">
            <input
              type="text"
              onChange={handleChange}
              value={values.opensource}
              name="name"
            />
            <button type="submit">Submit</button>
          </form>
        )}
      </Formik>
    );

    const button = getByText('Submit');
    button.focus(); // sets activeElement

    act(() => {
      fireEvent.submit(getByTestId('form'));
    });

    expect(global.console.warn).not.toHaveBeenCalledWith(
      expect.stringMatching(
        /Warning: You submitted a Formik form using a button with an unspecified type./
      )
    );

    button.blur(); // unsets activeElement
    (global.console.warn as jest.Mock<{}>).mockClear();
  });

  it('should not warn when activeElement is not a button', () => {
    render(
      <Formik onSubmit={noop} initialValues={{ opensource: 'yay' }}>
        {({ handleSubmit, handleChange, state: { values } }) => (
          <form onSubmit={handleSubmit} data-testid="form">
            <input
              type="text"
              onChange={handleChange}
              value={values.opensource}
              name="name"
              data-testid="name-input"
            />
            <button type="submit">Submit</button>
          </form>
        )}
      </Formik>
    );
    const input = screen.getByTestId('name-input');
    input.focus(); // sets activeElement

    act(() => {
      fireEvent.submit(screen.getByTestId('form'));
    });

    expect(global.console.warn).not.toHaveBeenCalledWith(
      expect.stringMatching(
        /Warning: You submitted a Formik form using a button with an unspecified type./
      )
    );

    input.blur(); // unsets activeElement
    (global.console.warn as jest.Mock<{}>).mockClear();
  });

  it('submit count increments', async () => {
    const onSubmit = jest.fn();

    const { getProps } = renderFormik({
      onSubmit,
    });

    expect(getProps().state.submitCount).toEqual(0);

    await act(async () => {
      await getProps().submitForm();
    });

    expect(onSubmit).toHaveBeenCalled();
    expect(getProps().state.submitCount).toEqual(1);
  });

  it('isValidating is fired when submit is attempted', async () => {
    const onSubmit = jest.fn();
    const validate = jest.fn(() => ({
      name: 'no',
    }));

    const { getProps } = renderFormik({
      onSubmit,
      validate,
    });

    expect(getProps().state.submitCount).toEqual(0);
    expect(getProps().state.isSubmitting).toBe(false);
    expect(getProps().state.isValidating).toBe(false);

    let submitFormPromise: Promise<any>;
    act(() => {
      // we call set isValidating synchronously
      submitFormPromise = getProps().submitForm();
    });

    // so it should change
    expect(getProps().state.isSubmitting).toBe(true);
    expect(getProps().state.isValidating).toBe(true);
    try {
      await act(async () => {
        // resolve the promise to check final state.
        await submitFormPromise;
      });
    } catch (err) {}
    // now both should be false because validation failed
    expect(getProps().state.isSubmitting).toBe(false);
    expect(getProps().state.isValidating).toBe(false);
    expect(validate).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getProps().state.submitCount).toEqual(1);
  });

  it('isSubmitting is fired when submit is attempted (v1)', async () => {
    const onSubmit = jest.fn();
    const validate = jest.fn(() => Promise.resolve({}));

    const { getProps } = renderFormik({
      onSubmit,
      validate,
    });

    expect(getProps().state.submitCount).toEqual(0);
    expect(getProps().state.isSubmitting).toBe(false);
    expect(getProps().state.isValidating).toBe(false);

    let submitFormPromise: Promise<any>;
    act(() => {
      // we call set isValidating synchronously
      submitFormPromise = getProps().submitForm();
    });

    // so it should change
    expect(getProps().state.isSubmitting).toBe(true);
    expect(getProps().state.isValidating).toBe(true);

    await act(async () => {
      // resolve the promise to check final state.
      await submitFormPromise;
    });

    // done validating and submitting
    expect(getProps().state.isSubmitting).toBe(true);
    expect(getProps().state.isValidating).toBe(false);
    expect(validate).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalled();
    expect(getProps().state.submitCount).toEqual(1);
  });

  it('isSubmitting is fired when submit is attempted (v2, promise)', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const validate = jest.fn(() => Promise.resolve({}));

    const { getProps } = renderFormik({
      onSubmit,
      validate,
    });

    expect(getProps().state.submitCount).toEqual(0);
    expect(getProps().state.isSubmitting).toBe(false);
    expect(getProps().state.isValidating).toBe(false);
    let submitFormPromise: Promise<any>;

    act(() => {
      // we call set isValidating synchronously
      submitFormPromise = getProps().submitForm();
    });

    // so it should change
    expect(getProps().state.isSubmitting).toBe(true);
    expect(getProps().state.isValidating).toBe(true);

    await act(async () => {
      // resolve the promise to check final state.
      await submitFormPromise;
    });

    // done validating and submitting
    expect(getProps().state.isSubmitting).toBe(false);
    expect(getProps().state.isValidating).toBe(false);
    expect(validate).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalled();
    expect(getProps().state.submitCount).toEqual(1);
  });

  it('isValidating is fired validation is run', async () => {
    const validate = jest.fn(() => ({ name: 'no' }));
    const { getProps } = renderFormik({
      validate,
    });

    expect(getProps().state.isValidating).toBe(false);

    let validatePromise: Promise<any>;
    act(() => {
      // we call set isValidating synchronously
      validatePromise = getProps().validateForm();
    });

    expect(getProps().state.isValidating).toBe(true);

    await act(async () => {
      await validatePromise;
    });

    expect(validate).toHaveBeenCalled();
    expect(getProps().state.isValidating).toBe(false);
  });

  it('should merge validation errors', async () => {
    const validate = () => ({
      users: [{ firstName: 'required' }],
    });
    const validationSchema = Yup.object({
      users: Yup.array().of(
        Yup.object({
          lastName: Yup.string().required('required'),
        })
      ),
    });

    const { getProps } = renderFormik({
      initialValues: { users: [{ firstName: '', lastName: '' }] },
      validate,
      validationSchema,
    });

    await act(async () => {
      await getProps().validateForm();
    });

    expect(getProps().state.errors).toEqual({
      users: [{ firstName: 'required', lastName: 'required' }],
    });
  });

  it('should not eat an error thrown by the validationSchema', async () => {
    const validationSchema = () => {
      throw new Error('broken validations');
    };

    const { getProps } = renderFormik({
      initialValues: { users: [{ firstName: '', lastName: '' }] },
      validationSchema,
    });

    let caughtError: string = '';

    await act(async () => {
      try {
        await getProps().validateForm();
      } catch (e) {
        expect(e instanceof Error).toBeTruthy();
        if (e instanceof Error) {
          caughtError = e.message;
        }
      }
    });

    expect(caughtError).toEqual('broken validations');
  });

  /*  it('exposes formikbag as imperative methods', () => {
    const innerRef: any = React.createRef();

    const { getProps } = renderFormik({ innerRef });

    expect(innerRef.current).toEqual(getProps());
  });*/

  it('change one field and will other fields run rerender', async () => {
    const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
      const renderCountRef = React.useRef(0);
      return (
        <>
          <span>
            {props.name}-{++renderCountRef.current}
          </span>
          <input {...props} />
        </>
      );
    };

    const ComponentContext = () => {
      useFormikContext();
      const renderCountRef = React.useRef(0);
      return <span>ComponentContext-{++renderCountRef.current}</span>;
    };

    const { getByText, getByTestId } = render(
      <Formik onSubmit={noop} initialValues={InitialValues}>
        <form onSubmit={noop} data-testid="form">
          <ComponentContext />
          <Field name="name" data-testid="name-input" as={Input} />
          <Field name="age" data-testid="age-input" as={Input} />
          <button type="submit">Submit</button>
        </form>
      </Formik>
    );

    await act(() => {
      fireEvent.change(getByTestId('name-input'), {
        target: {
          name: 'name',
          value: 'ian',
        },
      });
    });

    expect(getByText('name-2')).toBeTruthy();
    expect(getByText('age-1')).toBeTruthy();
    expect(getByText('ComponentContext-1')).toBeTruthy();
  });

  it('useFormikSelector', async () => {
    let formik: FormikProps<Values> = {} as any;
    const Submitting = () => {
      const isSubmitting = useFormikSelector(
        ({ isSubmitting }) => isSubmitting
      );
      return <div>{isSubmitting ? 'SubmittingTrue' : 'SubmittingFalse'}</div>;
    };
    const ComponentContext = () => {
      formik = useFormikContext();
      const renderCountRef = React.useRef(0);
      return <span>ComponentContext-{++renderCountRef.current}</span>;
    };
    const { getByText } = render(
      <Formik onSubmit={noop} initialValues={InitialValues}>
        <form onSubmit={noop} data-testid="form">
          <ComponentContext />
          <Submitting />
          <button type="submit">Submit</button>
        </form>
      </Formik>
    );

    await act(() => {
      formik.setSubmitting(true);
    });

    expect(getByText('SubmittingTrue')).toBeTruthy();
    expect(getByText('ComponentContext-1')).toBeTruthy();

    await act(() => {
      formik.setSubmitting(false);
    });

    expect(getByText('SubmittingFalse')).toBeTruthy();
    expect(getByText('ComponentContext-1')).toBeTruthy();
  });
});

/*

// test re-render use `useFormikContext`






 */
