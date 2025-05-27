import { Fragment } from "react";
import { Combobox as HCombobox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Combobox({ options, value, onChange, placeholder = "Select...", className }: ComboboxProps) {
  const selected = options.find((o) => o.value === value) || null;

  return (
    <div className={className}>
      <HCombobox value={selected} onChange={(option: ComboboxOption | null) => option && onChange(option.value)}>
        <div className="relative">
          <div className="relative w-full cursor-default overflow-hidden rounded-md border bg-white text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:text-sm">
            <HCombobox.Input
              className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
              displayValue={(option: ComboboxOption) => option?.label || ""}
              placeholder={placeholder}
            />
            <HCombobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </HCombobox.Button>
          </div>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => {}}
          >
            <HCombobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {options.length === 0 ? (
                <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                  No results found.
                </div>
              ) : (
                options.map((option) => (
                  <HCombobox.Option
                    key={option.value}
                    value={option}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pl-10 pr-4 ${
                        active ? "bg-blue-600 text-white" : "text-gray-900"
                      }`
                    }
                  >
                    {({ selected, active }) => (
                      <>
                        <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>{option.label}</span>
                        {selected ? (
                          <span
                            className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? "text-white" : "text-blue-600"}`}
                          >
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </HCombobox.Option>
                ))
              )}
            </HCombobox.Options>
          </Transition>
        </div>
      </HCombobox>
    </div>
  );
} 