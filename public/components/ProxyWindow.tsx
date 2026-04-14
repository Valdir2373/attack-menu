import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { UNFOCUS, SECONDARY } from "../theme.js";
import { useServices } from "../services/ServicesContext.js";
import { useObservable } from "../hooks/useObservable.js";

interface ProxyWindowProps {
  isFocused: boolean;
  height: number;
  onClose: () => void;
  onBlur: () => void;
}

export const ProxyWindow: React.FC<ProxyWindowProps> = ({
  isFocused,
  height,
  onClose,
  onBlur,
}) => {
  const { proxyController } = useServices();
  const proxyStatus = useObservable(proxyController.status$);
  const [message, setMessage] = useState("");

  useEffect(() => {
    proxyController.refreshStatus();
  }, [proxyController]);

  const startProxy = useCallback(async () => {
    try {
      await proxyController.startAmbient({ host: "127.0.0.1", port: 1080 });
      setMessage("Proxy iniciado");
    } catch (err: any) {
      setMessage(`Falha iniciar: ${err.message ?? err}`);
    }
  }, [proxyController]);

  const stopProxy = useCallback(async () => {
    try {
      await proxyController.stopAmbient();
      setMessage("Proxy parado");
    } catch (err: any) {
      setMessage(`Falha parar: ${err.message ?? err}`);
    }
  }, [proxyController]);

  useInput(
    (input, key) => {
      if (!isFocused) return;
      if (key.escape) {
        onBlur();
        return;
      }
      if (input === "q" || input === "Q") {
        onClose();
        return;
      }
      if (input === "s") {
        startProxy();
        return;
      }
      if (input === "x") {
        stopProxy();
        return;
      }
      if (input === "r") {
        proxyController.refreshStatus();
        return;
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box
      borderStyle="single"
      borderColor={SECONDARY}
      flexDirection="column"
      height={height}
      paddingX={1}
      paddingY={1}
      flexShrink={1}
    >
      <Text color={SECONDARY} bold>
        {"PROXY AMBIENT"}
      </Text>
      <Text>{`Status: container=${proxyStatus.containerName} | porta=${proxyStatus.port} | running=${proxyStatus.running}`}</Text>
      <Text>{`RUNNING: ${proxyStatus.running}`}</Text>
      <Text>{`Mensagem: ${message}`}</Text>
      <Text dimColor>
        {"Teclas: s=start, x=stop, r=status, q=fechar, Esc=voltar"}
      </Text>
    </Box>
  );
};

