import React, { Dispatch, SetStateAction, useCallback } from "react";
import { Text, useInput } from "ink";
import { FOCUS } from "../theme.js";
import { useServices } from "../services/ServicesContext.js";

export type CursorInputField = { value: string; pos: number };

const renderField = (f: CursorInputField, mask?: string): string => {
  const p = Math.max(0, Math.min(f.pos, f.value.length));
  if (mask) {
    return mask.repeat(p) + "|" + mask.repeat(f.value.length - p);
  }
  return f.value.slice(0, p) + "|" + f.value.slice(p);
};

const fLeft = (f: CursorInputField): CursorInputField => ({
  ...f,
  pos: Math.max(0, f.pos - 1),
});


const fBackspace = (f: CursorInputField): CursorInputField => {
  const { value, pos } = f;
  if (pos <= 0) return f;
  const next = value.slice(0, pos - 1) + value.slice(pos);
  return { value: next, pos: pos - 1 };
};

const fRight = (f: CursorInputField): CursorInputField => ({
  ...f,
  pos: Math.min(f.value.length, f.pos + 1),
});

const fInsert = (f: CursorInputField, ch: string): CursorInputField => ({
  value: f.value.slice(0, f.pos) + ch + f.value.slice(f.pos),
  pos: f.pos + 1,
});

const fPaste = (f: CursorInputField, text: string): CursorInputField => {
  const clean = text.replace(/\r\n/g, " ").replace(/\n/g, " ");
  return { value: f.value.slice(0, f.pos) + clean + f.value.slice(f.pos), pos: f.pos + clean.length };
};

type CursorTextInputProps = {
  field: CursorInputField;
  setField: Dispatch<SetStateAction<CursorInputField>>;
  isActive: boolean;
  color?: string;
  mask?: string;
};

export const CursorTextInput: React.FC<CursorTextInputProps> = ({
  field,
  setField,
  isActive,
  color = FOCUS,
  mask,
}) => {
  const { clipboardService } = useServices();

  const handler = useCallback(
    (input: string, key: any) => {
      if (key.leftArrow) {
        setField(fLeft);
        return;
      }
      if (key.rightArrow) {
        setField(fRight);
        return;
      }
      if (key.backspace || key.delete) {
        setField(fBackspace);
        return;
      }
      if (key.ctrl && (input === "v" || input === "V")) {
        clipboardService.read().then((text) => { if (text) setField((f) => fPaste(f, text)); });
        return;
      }
      if (input && input.length > 1) {
        setField((f) => fPaste(f, input));
        return;
      }
      if (input && input.length === 1) {
        setField((f) => fInsert(f, input));
        return;
      }
    },
    [setField, clipboardService],
  );

  useInput(handler, { isActive });

  return <Text color={color}>{renderField(field, mask)}</Text>;
};

