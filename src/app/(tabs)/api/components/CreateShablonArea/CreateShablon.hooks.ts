import { useState } from "react";

type ValueType = "title" | "api" | "model";

type ShablData = {
  title: string;
  api: string;
  model: string;
};

export type CreateShablonController = {
  handleChange: (value_type: ValueType, value: string) => void;
  Data: ShablData;
};

export function useCreateShablon(): CreateShablonController {
  const [Data, setData] = useState({
    title: "",
    api: "",
    model: "",
  });

  const handleChange = (value_type: ValueType, value: string) => {
    setData((prevState) => ({
      ...prevState,
      value_type: value,
    }));
  };

  return { handleChange, Data };
}
