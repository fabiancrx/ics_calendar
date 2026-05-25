declare module 'ical.js' {
  function parse(input: string): unknown;

  class Component {
    constructor(jCal: unknown);
    getAllSubcomponents(name: string): Component[];
    getAllProperties(name: string): Property[];
    getFirstProperty(name: string): Property | null;
    getFirstPropertyValue(name: string): unknown;
  }

  class Event {
    constructor(component: Component);
    summary: string;
    description: string;
    location: string;
    uid: string;
    startDate: Time;
    endDate: Time;
    recurrenceId: Time;
    component: Component;
    isRecurring(): boolean;
    isRecurrenceException(): boolean;
    iterator(): RecurExpansion;
    getOccurrenceDetails(occurrence: Time): OccurrenceDetails;
  }

  interface OccurrenceDetails {
    item: Event;
    startDate: Time;
    endDate: Time;
  }

  class Time {
    isDate: boolean;
    timezone: string;
    hour: number;
    minute: number;
    toJSDate(): Date;
    toString(): string;
  }

  class Property {
    getFirstValue(): unknown;
  }

  class RecurExpansion {
    next(): Time | null;
  }

  const TimezoneService: {
    register(timezone: Component): void;
  };
}
