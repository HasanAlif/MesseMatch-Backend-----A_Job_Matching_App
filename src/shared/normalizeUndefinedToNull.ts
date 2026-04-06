const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normalizeUndefinedToNull = <T>(input: T): T => {
  if (input === undefined) {
    return null as T;
  }

  if (input === null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => normalizeUndefinedToNull(item)) as T;
  }

  if (isPlainObject(input)) {
    const normalized: Record<string, unknown> = {};

    Object.keys(input).forEach((key) => {
      const value = input[key];
      normalized[key] = normalizeUndefinedToNull(value);
    });

    return normalized as T;
  }

  return input;
};

export default normalizeUndefinedToNull;
