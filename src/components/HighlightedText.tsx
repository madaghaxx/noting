import { Fragment } from "react";
import { Text } from "react-native";

import AppText from "@/src/components/ui/AppText";
import { useTheme } from "@/src/theme";
import { highlight } from "@/src/utils/search";

import type { ComponentProps } from "react";

type Props = ComponentProps<typeof AppText> & {
  text: string;
  /** The search term to emphasise. Nothing is emphasised when it is empty. */
  query: string;
};

/**
 * Text with the search term picked out.
 *
 * Built from `highlight`'s segments rather than by splicing markup into a string,
 * so the emphasis cannot corrupt the text around it — and so a term containing
 * regex or markdown characters is just a term.
 *
 * The whole line stays one `AppText`, which matters: nesting the runs keeps them on
 * the same baseline and lets the line wrap normally. Rendering each run as its own
 * element would break the line into unwrappable pieces.
 */
export default function HighlightedText({ text, query, ...rest }: Props) {
  const theme = useTheme();

  if (query.trim().length === 0) {
    return <AppText {...rest}>{text}</AppText>;
  }

  return (
    <AppText {...rest}>
      {highlight(text, query).map((segment, index) =>
        segment.match ? (
          <Text
            key={index}
            style={{
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.accentSubtle,
              fontWeight: "600",
            }}
          >
            {segment.text}
          </Text>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </AppText>
  );
}
