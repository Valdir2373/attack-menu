export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;

export class Observable<T> {
  private readonly _listeners = new Set<Listener<T>>();
  private _value: T;

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get value(): T {
    return this._value;
  }

  subscribe(listener: Listener<T>): Unsubscribe {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  emit(value: T): void {
    this._value = value;
    for (const listener of this._listeners) {
      listener(value);
    }
  }
}

