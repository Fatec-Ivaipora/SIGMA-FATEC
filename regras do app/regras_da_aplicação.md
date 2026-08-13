# Regras da Aplicação — Sistema de Submissão (MAC / MOPI)

## O que é o projeto

Uma ferramenta para gerenciar submissão de trabalhos acadêmicos em eventos como a **MAC** e a **MOPI** (mostras/eventos da Fatec). A ferramenta **DOIT** é citada como referência de modelo a seguir.

## Fluxo descrito

1. **Cadastro do aluno**
   - Aluno se cadastra na ferramenta.
   - Sistema envia e-mail confirmando o cadastro.
   - Suporte a redefinição de senha (fluxo básico de autenticação).

2. **Validação de duplicidade**
   - Nem todo participante de um grupo pode se cadastrar/enviar separadamente.
   - Se um trabalho já foi enviado com determinado título/participantes, e outro integrante tentar enviar o mesmo trabalho, o sistema deve bloquear e avisar que já existe envio para aquele trabalho.

3. **Envio do trabalho**
   - Aluno preenche informações do trabalho e do orientador.

4. **Avaliação**
   - Um professor avaliador entra, dá nota e decide: aceito ou não aceito.

5. **Aprovação final / organização**
   - Se o professor aceitar sem pedir correção, o trabalho segue direto para a organização do evento.
   - A organização confirma o aceite final e emite a **carta de aceite**.
   - Se precisar de correção, deve haver uma etapa de retorno ao aluno.

6. **Certificação**
   - Emissão de certificados para: apresentadores/alunos e professores/avaliadores.

7. **Relatórios finais**
   - Relatório de participantes.
   - Relatório de envio.
   - Relatório de aceite.
   - Relatório de não aceito.

## Em resumo

É basicamente um sistema de submissão e avaliação de trabalhos acadêmicos (fluxo parecido com o de um congresso científico): **cadastro → envio → avaliação/nota → aceite ou correção → aceite final da organização → certificação → relatórios**.

## Fonte

Transcrição original: `C:\Users\supor\OneDrive\Documentos\Mateus\exemplos\FLUXOGRAMA - SISTEMA MAC - MOPI-transcript.txt`
