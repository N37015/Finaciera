# Esta fase se usa cuando se ejecuta desde VS en modo rápido
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080

# Esta fase se usa para compilar el proyecto de servicio
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
RUN apt-get update && apt-get install -y libgssapi-krb5-2
COPY ["FintechNova.API/FintechNova.API.csproj", "FintechNova.API/"]
RUN dotnet restore "./FintechNova.API/FintechNova.API.csproj"
COPY . .
WORKDIR "/src/FintechNova.API"
RUN dotnet build "./FintechNova.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Esta fase se usa para publicar el proyecto de servicio que se copiará en la fase final.
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./FintechNova.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Esta fase se usa en producción
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FintechNova.API.dll"]