import { useState, useEffect } from "react";
import type { Observable } from "../../src/shared/Observable.js";


export function useObservable<T>(observable: Observable<T>): T {
  const [value, setValue] = useState<T>(observable.value);

  useEffect(() => {
    setValue(observable.value);
    return observable.subscribe(setValue);
  }, [observable]);

  return value;
}

