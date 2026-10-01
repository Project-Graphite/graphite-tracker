import { GridListbox } from '@project-graphite/ui';

const firstYear = 1950;
const lastYear = new Date().getFullYear() + 2;

const decades = Array.from(
  { length: Math.floor(lastYear / 10) - Math.floor(firstYear / 10) + 1 },
  (_, index) => {
    const start = (Math.floor(lastYear / 10) - index) * 10;
    return {
      label: `${start}s`,
      options: Array.from({ length: 10 }, (_, offset) => start + 9 - offset)
        .filter((year) => year >= firstYear && year <= lastYear)
        .map((year) => ({ label: String(year), value: String(year) })),
    };
  },
);

export function YearPicker({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  return <GridListbox defaultValue={defaultValue} emptyLabel="Any year" groups={decades} label={label} name={name} />;
}
